from fastapi import FastAPI

app = FastAPI(title="Contract Privacy Gateway")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
