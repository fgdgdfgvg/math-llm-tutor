# Math LLM Tutor System

This project combines the strengths of multiple educational systems to create a specialized Math Education Platform powered by LLMs (Large Language Models) and Python's symbolic computation capabilities.

## Project Structure

- **backend/**: Python (FastAPI) backend.
  - Handles API requests.
  - Manages database (SQLite for dev, easily switchable to MySQL/PostgreSQL).
  - Integrates LangChain and SymPy for math problem solving.
- **frontend/**: React (Ant Design Pro) frontend.
  - Based on `smartclass-manage-frontend`.
  - Includes a new "Math Problem Solving" module.
- **datasets/**: Place your JSON data files here.

## Setup Instructions

### Backend (Python)

1.  Navigate to `backend` directory.
2.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
    *(Note: You may need to create a virtual environment first)*
3.  Run the server:
    ```bash
    uvicorn app.main:app --reload
    ```
    The API will be available at `http://localhost:8000`.

### Frontend (React)

1.  Navigate to `frontend` directory.
2.  Install dependencies:
    ```bash
    npm install
    # or
    yarn install
    ```
3.  Start the development server:
    ```bash
    npm start
    # or
    yarn start
    ```
    The application will run at `http://localhost:8000` (or another port if configured).

## Data Import

To import your existing question bank (JSON format):

```bash
python import_data.py path/to/your/data.json
```

## Key Features Implemented

1.  **Data Models**: Ported from `UExam` (Java) to Python `SQLModel`.
    - `Question`: Stores problem text, difficulty, type, and standard solution steps.
    - `ExamPaper`: Structure for exams.
    - `AiReviewRule`: Configuration for AI agents (from `Nengdou`).
2.  **Frontend Integration**:
    - Integrated `SmartClass` UI shell.
    - Added dedicated "Math Problem Solving" page.
