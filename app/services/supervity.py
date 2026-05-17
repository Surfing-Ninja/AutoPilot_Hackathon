# app/services/supervity.py
import httpx
import os
import logging

logger = logging.getLogger(__name__)

SUPERVITY_API_URL = os.getenv("SUPERVITY_API_URL", "https://api.supervity.ai/v1/workflow/execute")
SUPERVITY_BEARER_TOKEN = os.getenv("SUPERVITY_BEARER_TOKEN", "mock_token")
SUPERVITY_WORKFLOW_ID = os.getenv("SUPERVITY_WORKFLOW_ID", "mock_workflow_id")

async def call_supervity_workflow(payload: dict) -> dict:
    """
    Calls the Supervity workflow API to execute operators.
    """
    headers = {
        "Authorization": f"Bearer {SUPERVITY_BEARER_TOKEN}",
        "Content-Type": "application/json"
    }
    
    body = {
        "workflowId": SUPERVITY_WORKFLOW_ID,
        "payload": payload
    }
    
    logger.info(f"Calling Supervity workflow {SUPERVITY_WORKFLOW_ID} with payload keys: {list(payload.keys())}")
    
    if SUPERVITY_BEARER_TOKEN == "mock_token":
        logger.warning("Using mock token, returning mocked Supervity response.")
        return {
            "status": "success",
            "executionId": "mock_exec_123",
            "message": "Workflow executed (mocked)"
        }
        
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                SUPERVITY_API_URL,
                json=body,
                headers=headers,
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Failed to execute Supervity workflow: {e}")
            raise
