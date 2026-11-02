# FB13 trade slip API. Built by cloudbuild.yaml with the repository root as the
# context (-f server/Dockerfile .), so every path below starts from the root.
# Python 3.12: the fleet standard (Charles, 2 November 2026).

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /srv
COPY server/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# package.json gives the server its version (app/version.py): one version for the whole unit.
COPY package.json ./package.json
COPY server/app ./app

ARG FB13_COMMIT=
ENV FB13_COMMIT=${FB13_COMMIT}

# Fail the build, not the deploy, on a syntax or import error. Not a test:
# importing opens no connection (no bucket named, no Access configured).
RUN python -m compileall -q app && python -c "import app.main"

RUN useradd --create-home --uid 10001 fb13
USER fb13

EXPOSE 8080
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1 --no-access-log --timeout-graceful-shutdown 5"]
