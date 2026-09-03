from fastapi import APIRouter, Depends, HTTPException, status
from app.api.auth import require_role
from app.jobs import create_job, get_job, run_overdue_report_task
from app.models.user import UserRole

router = APIRouter(prefix="/reports", tags=["reports"])

@router.post("/overdue", status_code=status.HTTP_202_ACCEPTED)
def trigger_overdue_report(_librarian=Depends(require_role(UserRole.LIBRARIAN))):
    """Starts the overdue-loan analysis in the background."""
    job_id = create_job()
    run_overdue_report_task.delay(job_id)
    return {"job_id": job_id, "status": "pending"}

@router.get("/overdue/{job_id}")
def get_overdue_report(job_id: str, _librarian=Depends(require_role(UserRole.LIBRARIAN))):
    """Retrieve status or results of a triggered background report."""
    job = get_job(job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Job not found or expired"
        )
    return job
