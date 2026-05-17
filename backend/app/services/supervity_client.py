import requests
import os
from dotenv import load_dotenv

load_dotenv()

def execute_workflow(company_name, company_domain, lead_email):

    url = os.getenv("SUPERVITY_BASE_URL")

    headers = {
        "Authorization": f"Bearer {os.getenv('SUPERVITY_API_KEY')}",
        "x-source": "v1"
    }

    files = {
        "workflowId": (None, os.getenv("SUPERVITY_WORKFLOW_ID")),
        "inputs[company_name]": (None, company_name),
        "inputs[company_domain]": (None, company_domain),
        "inputs[lead_email]": (None, lead_email)
    }

    response = requests.post(
        url,
        headers=headers,
        files=files
    )

    return response.json()
