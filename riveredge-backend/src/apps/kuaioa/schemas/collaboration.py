"""制造协同 schemas。"""



from decimal import Decimal

from typing import Optional



from pydantic import BaseModel, Field





class SpecialPriceRequestCreate(BaseModel):

    title: str = Field(..., max_length=200)

    customer_name: Optional[str] = Field(None, max_length=200)

    material_code: Optional[str] = Field(None, max_length=100)

    material_name: Optional[str] = Field(None, max_length=200)

    current_price: Optional[Decimal] = None

    requested_price: Optional[Decimal] = None

    quantity: Optional[Decimal] = None

    valid_until: Optional[str] = None

    reason: Optional[str] = None

    source_app: Optional[str] = Field(None, max_length=50)

    source_entity_type: Optional[str] = Field(None, max_length=50)

    source_entity_id: Optional[int] = None

    source_doc_no: Optional[str] = Field(None, max_length=100)

    department_name: Optional[str] = None

    notes: Optional[str] = None





class SpecialPriceRequestUpdate(BaseModel):

    title: Optional[str] = Field(None, max_length=200)

    customer_name: Optional[str] = Field(None, max_length=200)

    material_code: Optional[str] = Field(None, max_length=100)

    material_name: Optional[str] = Field(None, max_length=200)

    current_price: Optional[Decimal] = None

    requested_price: Optional[Decimal] = None

    quantity: Optional[Decimal] = None

    valid_until: Optional[str] = None

    reason: Optional[str] = None

    source_app: Optional[str] = Field(None, max_length=50)

    source_entity_type: Optional[str] = Field(None, max_length=50)

    source_entity_id: Optional[int] = None

    source_doc_no: Optional[str] = Field(None, max_length=100)

    department_name: Optional[str] = None

    notes: Optional[str] = None





class ConcessionRequestCreate(BaseModel):

    title: str = Field(..., max_length=200)

    source_app: Optional[str] = Field(None, max_length=50)

    source_entity_type: Optional[str] = Field(None, max_length=50)

    source_entity_id: Optional[int] = None

    source_doc_no: Optional[str] = Field(None, max_length=100)

    material_code: Optional[str] = Field(None, max_length=100)

    material_name: Optional[str] = Field(None, max_length=200)

    concession_qty: Optional[Decimal] = None

    defect_description: Optional[str] = None

    notify_customer: bool = False

    department_name: Optional[str] = None

    notes: Optional[str] = None





class ConcessionRequestUpdate(BaseModel):

    title: Optional[str] = Field(None, max_length=200)

    source_app: Optional[str] = Field(None, max_length=50)

    source_entity_type: Optional[str] = Field(None, max_length=50)

    source_entity_id: Optional[int] = None

    source_doc_no: Optional[str] = Field(None, max_length=100)

    material_code: Optional[str] = Field(None, max_length=100)

    material_name: Optional[str] = Field(None, max_length=200)

    concession_qty: Optional[Decimal] = None

    defect_description: Optional[str] = None

    notify_customer: Optional[bool] = None

    department_name: Optional[str] = None

    notes: Optional[str] = None





class ProcessDeviationCreate(BaseModel):

    title: str = Field(..., max_length=200)

    source_app: Optional[str] = Field(None, max_length=50)

    source_entity_type: Optional[str] = Field(None, max_length=50)

    source_entity_id: Optional[int] = None

    source_doc_no: Optional[str] = Field(None, max_length=100)

    operation_name: Optional[str] = Field(None, max_length=200)

    deviation_description: Optional[str] = None

    start_at: Optional[str] = None

    end_at: Optional[str] = None

    risk_assessment: Optional[str] = None

    temporary_measure: Optional[str] = None

    department_name: Optional[str] = None

    notes: Optional[str] = None





class ProcessDeviationUpdate(BaseModel):

    title: Optional[str] = Field(None, max_length=200)

    source_app: Optional[str] = Field(None, max_length=50)

    source_entity_type: Optional[str] = Field(None, max_length=50)

    source_entity_id: Optional[int] = None

    source_doc_no: Optional[str] = Field(None, max_length=100)

    operation_name: Optional[str] = Field(None, max_length=200)

    deviation_description: Optional[str] = None

    start_at: Optional[str] = None

    end_at: Optional[str] = None

    risk_assessment: Optional[str] = None

    temporary_measure: Optional[str] = None

    department_name: Optional[str] = None

    notes: Optional[str] = None


