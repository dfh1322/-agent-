"""ContactMessage — 用户联系房东的留言记录。"""
from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship
from config.database import Base


class ContactMessage(Base):
    __tablename__ = "contact_messages"

    id = Column(Integer, primary_key=True, index=True)
    landlord_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    guest_name = Column(String(50), nullable=False)
    guest_phone = Column(String(20), nullable=False)
    community_id = Column(Integer, ForeignKey("communities.id"), nullable=True)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=True)
    message = Column(Text, nullable=False)
    preferred_date = Column(Date, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    unit_ref = relationship("Unit", back_populates="contact_messages",
                            foreign_keys=[unit_id])
