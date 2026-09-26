.PHONY: install frontend build serve dev test lint clean

install:
	python -m venv .venv
	.venv/bin/pip install -e ".[dev]"

frontend:
	cd frontend && npm install && npm run build

build: frontend
	.venv/bin/pip install -e .

serve:
	.venv/bin/webcrawler serve --data-dir data

dev:
	cd frontend && npm run dev

test:
	.venv/bin/pytest -v

lint:
	.venv/bin/ruff check webcrawler tests

clean:
	rm -rf .venv data frontend/node_modules webcrawler/static/dist
	find . -type d -name __pycache__ -exec rm -rf {} +
