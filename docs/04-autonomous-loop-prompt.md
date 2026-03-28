# Autonomous Migration Loop Prompt

Copy and paste the prompt below to start an autonomous Claude Code session that continues the Shopingy-to-Keboola migration from wherever it left off.

---

## Prompt

```
You are continuing the Shopingy-to-Keboola migration project. Work autonomously through the phases below. Before each phase, read the plan and check what's already done.

## Instructions
1. Read docs/01-architecture.md, docs/02-keboola-migration-plan.md, docs/03-migration-instructions.md
2. Read the plan at the path shown by: ls ~/.claude/plans/*.md (pick the most recent)
3. Check current test status: .venv/bin/pytest -q --tb=line
4. Determine which phase to work on next based on test results
5. Use parallel subagents for independent tasks within each phase
6. After completing each phase, run the relevant tests and confirm they pass
7. Commit completed work to a feature branch

## Phase Progression

### Phase B: Extraction Implementation (if test_transform tests are SKIPPED)
- Create src/shopingy/config.py, auth.py, api.py, transform.py
- Run tests until green: pytest tests/test_auth.py tests/test_enums.py tests/test_api_data.py tests/test_transform.py -v
- Create scripts/extract_shopingy.py, run it, verify CSVs in data/processed/
- Key: /api/shops/ needs form-encoded POST (not JSON), stores have 23 columns, _csrf_token field name

### Phase C: Keboola Upload (if test_keboola_storage tests are SKIPPED)
- Create src/shopingy/keboola_loader.py using Keboola Storage REST API
- Create scripts/upload_to_keboola.py
- Buckets: in.c-shopingy (facts), in.c-shopingy-enums (lookups)
- Run tests: pytest tests/test_keboola_connection.py tests/test_keboola_storage.py tests/test_data_quality.py -v
- Keboola project 2835 on europe-west3.gcp.keboola.com, BigQuery dialect

### Phase D: SQL Transformations (if data quality tests PASS)
- Use Keboola MCP create_sql_transformation (BigQuery SQL)
- Create: mall_summary, brand_penetration, category_mix_by_mall, store_movement, gap_analysis_base
- Output bucket: out.c-shopingy-analytics

### Phase E: Streamlit Dashboard (if transformations exist)
- Use keboola-data-app skill for guidance
- Build Streamlit app in app/ directory
- Deploy via Keboola MCP deploy_data_app

## Rules
- No hardcoded values - everything from .env or config
- No mocks - real implementations only
- Use httpx for HTTP, pytest for tests, pathlib for paths
- Scripts in scripts/, troubleshooting in .scratch/, data in data/
- Use git worktree for feature branches
- Run tests after each implementation step
- If blocked, document the issue and move to the next unblocked phase
```

---

## Quick Start Commands

```bash
# Check current state
.venv/bin/pytest -q --tb=line

# Run specific phase tests
.venv/bin/pytest tests/test_auth.py tests/test_enums.py tests/test_api_data.py -v  # Phase B extraction
.venv/bin/pytest tests/test_transform.py -v                                         # Phase B transform
.venv/bin/pytest tests/test_keboola_storage.py tests/test_data_quality.py -v        # Phase C upload
```
