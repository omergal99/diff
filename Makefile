# ================================================================
# Diffinity Makefile
# ================================================================
# make setup  — install all dependencies
# make dev    — start backend + frontend dev server
# make test   — run all tests
# make lint   — run ruff linter
# make clean  — remove virtual env and caches
# ================================================================

SHELL   := /bin/bash
VENV    := .venv
PY      := $(VENV)/bin/python
PIP     := $(VENV)/bin/pip
UVICORN := $(VENV)/bin/uvicorn
PYTEST  := $(VENV)/bin/pytest
RUFF    := $(VENV)/bin/ruff

.DEFAULT_GOAL := dev

# ── Colours ──────────────────────────────────────────────────────
GREEN  := \033[0;32m
YELLOW := \033[0;33m
BLUE   := \033[0;34m
RESET  := \033[0m

# ─────────────────────────────────────────────────────────────────
.PHONY: dev setup install-backend install-frontend test test-backend \
        lint clean check-deps serve-frontend help

# ── dev: check deps then start everything ────────────────────────
dev: check-deps
	@echo -e "$(GREEN)Starting Diffinity…$(RESET)"
	@echo -e "$(BLUE)  Backend : http://localhost:8000$(RESET)"
	@echo -e "$(BLUE)  Frontend: http://localhost:3000$(RESET)"
	@echo -e "$(BLUE)  API docs: http://localhost:8000/api/docs$(RESET)"
	@$(MAKE) -j2 serve-backend serve-frontend

# ── check-deps: auto-run setup if venv missing ───────────────────
check-deps:
	@if [ ! -f "$(PY)" ]; then \
		echo -e "$(YELLOW)Virtual environment not found. Running setup…$(RESET)"; \
		$(MAKE) setup; \
	fi
	@if [ ! -d "node_modules" ]; then \
		echo -e "$(YELLOW)node_modules not found. Checking for Node.js…$(RESET)"; \
		command -v node >/dev/null 2>&1 && $(MAKE) install-frontend || true; \
	fi

# ── setup: full first-time install ───────────────────────────────
setup: install-backend install-frontend
	@echo -e "$(GREEN)✓ Setup complete. Run 'make dev' to start.$(RESET)"

# ── Python venv + deps ───────────────────────────────────────────
install-backend:
	@echo -e "$(YELLOW)Creating Python virtual environment…$(RESET)"
	@python3 -m venv $(VENV)
	@echo -e "$(YELLOW)Installing Python dependencies…$(RESET)"
	@$(PIP) install --upgrade pip -q
	@$(PIP) install -r backend/requirements.txt
	@$(PIP) install pytest ruff -q
	@echo -e "$(GREEN)✓ Python backend ready$(RESET)"

# ── Node dev server (optional, only if Node is available) ────────
install-frontend:
	@command -v node >/dev/null 2>&1 || { echo "Node.js not found — frontend will be served by Python"; exit 0; }
	@command -v npm  >/dev/null 2>&1 && npm install --prefix . 2>/dev/null || true
	@echo -e "$(GREEN)✓ Frontend ready$(RESET)"

# ── Start servers ─────────────────────────────────────────────────
serve-backend:
	@cd backend && PYTHONPATH=. $(UVICORN) main:app --reload --port 8000 --log-level info

serve-frontend:
	@command -v npx >/dev/null 2>&1 \
		&& npx --yes serve frontend -p 3000 \
		|| (cd backend && $(PY) -m http.server 3000 --directory ../frontend)

# ── Tests ────────────────────────────────────────────────────────
test: test-backend
	@echo -e "$(GREEN)✓ All tests passed$(RESET)"

test-backend:
	@echo -e "$(YELLOW)Running backend tests…$(RESET)"
	@cd backend && PYTHONPATH=. $(PYTEST) tests/ -v --tb=short

test-watch:
	@cd backend && PYTHONPATH=. $(PYTEST) tests/ -v --tb=short -f

# ── Lint ─────────────────────────────────────────────────────────
lint:
	@echo -e "$(YELLOW)Linting Python code…$(RESET)"
	@$(RUFF) check backend/ --fix

# ── Clean ────────────────────────────────────────────────────────
clean:
	@echo -e "$(YELLOW)Cleaning up…$(RESET)"
	@rm -rf $(VENV) __pycache__ backend/__pycache__ \
	        backend/**/__pycache__ .pytest_cache \
	        backend/.pytest_cache node_modules
	@find . -name "*.pyc" -delete
	@find . -name ".DS_Store" -delete
	@echo -e "$(GREEN)✓ Clean$(RESET)"

# ── Help ─────────────────────────────────────────────────────────
help:
	@echo ""
	@echo -e "$(BLUE)Diffinity — Available Commands$(RESET)"
	@echo "  make setup         Install all dependencies (first-time setup)"
	@echo "  make dev           Start backend + frontend (auto-runs setup if needed)"
	@echo "  make test          Run all tests"
	@echo "  make test-watch    Run tests in watch mode"
	@echo "  make lint          Lint Python with ruff"
	@echo "  make clean         Remove venv and caches"
	@echo ""
