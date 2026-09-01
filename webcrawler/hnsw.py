from __future__ import annotations

import heapq
import math
import random
from pathlib import Path

import numpy as np


class HNSWIndex:
    """Cosine HNSW based on Malkov & Yashunin (2018), implemented from scratch."""
    def __init__(self, dimensions: int, m: int = 16, ef_construction: int = 200, seed: int = 42):
        self.dimensions, self.m, self.ef_construction = dimensions, m, ef_construction
        self.vectors = np.empty((0, dimensions), dtype=np.float32)
        self.layers: list[dict[int, list[int]]] = []
        self.levels: list[int] = []
        self.entry_point: int | None = None
        self.max_level = -1
        self.rng = random.Random(seed)

    def _distance(self, vector: np.ndarray, identifier: int) -> float:
        return float(1.0 - np.dot(vector, self.vectors[identifier]))

    def _random_level(self) -> int:
        return int(-math.log(self.rng.random()) / math.log(self.m))

    def _search_layer(self, query: np.ndarray, entry: list[int], ef: int, layer: int) -> list[int]:
        visited = set(entry)
        candidates = [(self._distance(query, node), node) for node in entry]
        heapq.heapify(candidates)
        results = [(-distance, node) for distance, node in candidates]
        heapq.heapify(results)
        while candidates:
            distance, current = heapq.heappop(candidates)
            if distance > -results[0][0]:
                break
            for neighbor in self.layers[layer].get(current, []):
                if neighbor in visited:
                    continue
                visited.add(neighbor)
                candidate_distance = self._distance(query, neighbor)
                if len(results) < ef or candidate_distance < -results[0][0]:
                    heapq.heappush(candidates, (candidate_distance, neighbor))
                    heapq.heappush(results, (-candidate_distance, neighbor))
                    if len(results) > ef:
                        heapq.heappop(results)
        return [node for _, node in results]

    def _prune(self, node: int, layer: int) -> None:
        neighbors = self.layers[layer][node]
        if len(neighbors) > self.m:
            self.layers[layer][node] = sorted(neighbors, key=lambda candidate: self._distance(self.vectors[node], candidate))[:self.m]

    def add(self, vector: np.ndarray) -> int:
        vector = vector.astype(np.float32, copy=False)
        vector /= max(float(np.linalg.norm(vector)), 1e-12)
        identifier, level = len(self.vectors), self._random_level()
        self.vectors = np.vstack((self.vectors, vector[None, :]))
        while len(self.layers) <= level:
            self.layers.append({})
        for layer in self.layers[:level + 1]:
            layer[identifier] = []
        if self.entry_point is None:
            self.entry_point, self.max_level = identifier, level
            self.levels.append(level)
            return identifier
        current = self.entry_point
        for layer in range(self.max_level, level, -1):
            current = min(self._search_layer(vector, [current], 1, layer), key=lambda node: self._distance(vector, node))
        for layer in range(min(level, self.max_level), -1, -1):
            candidates = self._search_layer(vector, [current], self.ef_construction, layer)
            selected = sorted(candidates, key=lambda node: self._distance(vector, node))[:self.m]
            self.layers[layer][identifier] = selected
            for neighbor in selected:
                self.layers[layer][neighbor].append(identifier)
                self._prune(neighbor, layer)
            if selected:
                current = selected[0]
        if level > self.max_level:
            self.entry_point, self.max_level = identifier, level
        self.levels.append(level)
        return identifier

    def add_many(self, vectors: np.ndarray) -> None:
        for vector in vectors:
            self.add(vector.copy())

    def search(self, query: np.ndarray, k: int = 10, ef: int = 100) -> list[tuple[int, float]]:
        if self.entry_point is None:
            return []
        query = query.astype(np.float32, copy=True)
        query /= max(float(np.linalg.norm(query)), 1e-12)
        current = self.entry_point
        for layer in range(self.max_level, 0, -1):
            current = min(self._search_layer(query, [current], 1, layer), key=lambda node: self._distance(query, node))
        nodes = self._search_layer(query, [current], max(k, ef), 0)
        return [(node, 1 - self._distance(query, node)) for node in sorted(nodes, key=lambda node: self._distance(query, node))[:k]]

    def save(self, path: Path) -> None:
        encoded = {"vectors": self.vectors, "levels": np.array(self.levels), "entry": np.array([-1 if self.entry_point is None else self.entry_point]), "max_level": np.array([self.max_level]), "m": np.array([self.m]), "ef": np.array([self.ef_construction])}
        for level, graph in enumerate(self.layers):
            encoded[f"layer_{level}"] = np.array([graph], dtype=object)
        np.savez_compressed(path, **encoded)

    @classmethod
    def load(cls, path: Path) -> "HNSWIndex":
        data = np.load(path, allow_pickle=True)
        index = cls(data["vectors"].shape[1], int(data["m"][0]), int(data["ef"][0]))
        index.vectors, index.levels = data["vectors"], data["levels"].tolist()
        index.entry_point, index.max_level = int(data["entry"][0]), int(data["max_level"][0])
        if index.entry_point == -1:
            index.entry_point = None
        index.layers = [data[f"layer_{level}"][0].item() if hasattr(data[f"layer_{level}"][0], "item") else data[f"layer_{level}"][0] for level in range(index.max_level + 1)]
        return index
