"""ContactMessage — 用户联系房东的留言记录。"""
from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text, func
from config.database import Base


class ContactMessage(Base):
    __tablename__ = "contact_messages"

    id = Column(Integer, primary_key=True, index=True)
    landlord_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    guest_name = Column(String(50), nullable=False)
    guest_phone = Column(String(20), nullable=False)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=True)
    message = Column(Text, nullable=False)
    preferred_date = Column(Date, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
