from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from decimal import Decimal
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(50), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'role': self.role,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class IncomeContract(db.Model):
    """Доходные договоры"""
    __tablename__ = 'income_contracts'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    contract_number = db.Column(db.String(50), unique=True, nullable=False)
    contract_date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    client = db.Column(db.String(200), nullable=False)
    contract_amount = db.Column(db.Numeric(15, 2), nullable=False)
    paid_amount = db.Column(db.Numeric(15, 2), default=0)
    status = db.Column(db.String(50), default='active')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = db.Column(db.DateTime, nullable=True)

    # Связь с расходными договорами
    expense_contracts = db.relationship('ExpenseContract', backref='income_contract', lazy=True)

    def __repr__(self):
        return f'<IncomeContract {self.contract_number}>'


class ExpenseContract(db.Model):
    """Расходные договоры"""
    __tablename__ = 'expense_contracts'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    contract_number = db.Column(db.String(50), unique=True, nullable=False)
    type_contract = db.Column(db.String(100), nullable=False)
    start_date = db.Column(db.DateTime, nullable=False)
    end_date = db.Column(db.DateTime, nullable=False)
    name = db.Column(db.String(300), nullable=False)
    client = db.Column(db.String(200), nullable=False)  # Контрагент
    contract_amount = db.Column(db.Numeric(15, 2), nullable=False)
    advance_percentage = db.Column(db.Numeric(5, 2), default=0)
    payment_loesk = db.Column(db.Numeric(15, 2), default=0)
    income_contract_id = db.Column(db.Integer, db.ForeignKey('income_contracts.id'), nullable=False)
    status = db.Column(db.String(50), default='active')
    is_mes = db.Column(db.Boolean, default=False)  # Признак МЭС
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = db.Column(db.DateTime, nullable=True)

    # Связи с дополнительными таблицами
    cal_plans = db.relationship('CalPlan', backref='expense_contract', lazy=True)
    cost_items = db.relationship('CostItem', backref='expense_contract', lazy=True)
    closed_works = db.relationship('ClosedWork', backref='expense_contract', lazy=True)

    def __repr__(self):
        return f'<ExpenseContract {self.contract_number}>'


class CalPlan(db.Model):
    """Календарный план для планирования по месяцам"""
    __tablename__ = 'cal_plan'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    iddog = db.Column(db.Integer, db.ForeignKey('expense_contracts.id'), nullable=False)
    date = db.Column(db.DateTime, nullable=False)
    plopl = db.Column(db.Numeric(10, 2), default=0)

    def __repr__(self):
        return f'<CalPlan {self.id}>'


class CostItem(db.Model):
    """Статьи затрат для расчета затрат подрядчика"""
    __tablename__ = 'cost_items'

    id = db.Column(db.Integer, primary_key=True)
    contract_id = db.Column(db.Integer, db.ForeignKey('expense_contracts.id'), nullable=False)
    date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    kontragent = db.Column(db.String(200), nullable=False)
    category = db.Column(db.String(200), nullable=False)
    purpose = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)

    def __repr__(self):
        return f'<CostItem {self.id}>'


class ClosedWork(db.Model):
    """Закрытые работы по актам КС"""
    __tablename__ = 'closed_works'

    id = db.Column(db.Integer, primary_key=True)
    contract_id = db.Column(db.Integer, db.ForeignKey('expense_contracts.id'), nullable=False)
    act_number = db.Column(db.String(100), nullable=False)
    act_date = db.Column(db.DateTime, nullable=False)
    amount = db.Column(db.Numeric(15, 2), nullable=False)
    file_name = db.Column(db.String(255))  # Новое поле: имя файла
    file_path = db.Column(db.String(500))  # Новое поле: путь к файлу
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'contract_id': self.contract_id,
            'act_number': self.act_number,
            'act_date': self.act_date.strftime('%Y-%m-%d'),
            'amount': str(self.amount),
            'file_url': f'/api/closed-works/{self.id}/file' if self.file_path else None,
            'file_name': self.file_name,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }