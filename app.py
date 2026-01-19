from flask import Flask, render_template, jsonify, request, session, send_file
from flask_cors import CORS
from models import db, User, IncomeContract, ExpenseContract, CalPlan, CostItem, ClosedWork
from datetime import datetime, timedelta
from decimal import Decimal
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///finance.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'your-secret-key-here'

# Конфигурация загрузки файлов
UPLOAD_FOLDER = 'uploads/closed_works'
ALLOWED_EXTENSIONS = {'pdf'}
MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

db.init_app(app)
CORS(app)


# Создание таблиц
with app.app_context():
    db.create_all()


def format_currency(value):
    if value is None:
        return '0 ₽'
    return f"{value:,.2f} ₽".replace(',', ' ').replace('.', ',')


# Вспомогательные функции для расчетов
def calculate_advance_amount(contract_amount, advance_percentage):
    if advance_percentage:
        return (contract_amount * advance_percentage) / 100
    return Decimal('0')


def calculate_contractor_costs(cost_items):
    total = Decimal('0')
    for cost_item in cost_items:
        total += cost_item.amount
    return total


def calculate_balance(payment_loesk, contractor_costs):
    return (payment_loesk or Decimal('0')) - contractor_costs


def calculate_remaining_funding(contract_amount, payment_loesk):
    return (contract_amount or Decimal('0')) - (payment_loesk or Decimal('0'))


def allowed_file(filename):
    if not filename or '.' not in filename:
        return False
    return filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def ensure_upload_folder():
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)


def get_planning_data(cal_plans):
    current_date = datetime.now()

    # Получаем даты для текущего и следующих двух месяцев
    current_month = current_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    next_month_1 = (current_month.replace(day=28) + timedelta(days=4)).replace(day=1)
    next_month_2 = (next_month_1.replace(day=28) + timedelta(days=4)).replace(day=1)

    # Получаем названия месяцев для отображения
    month_names = {
        'current_month': current_month.strftime('%B %Y'),
        'next_month_1': next_month_1.strftime('%B %Y'),
        'next_month_2': next_month_2.strftime('%B %Y')
    }

    current_month_plan = Decimal('0')
    next_month_1_plan = Decimal('0')
    next_month_2_plan = Decimal('0')

    for plan in cal_plans:
        if plan.date and plan.plopl:
            plan_date = plan.date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            if plan_date == current_month:
                current_month_plan += plan.plopl
            elif plan_date == next_month_1:
                next_month_1_plan += plan.plopl
            elif plan_date == next_month_2:
                next_month_2_plan += plan.plopl

    return {
        'current_month': current_month_plan,
        'next_month_1': next_month_1_plan,
        'next_month_2': next_month_2_plan,
        'three_month_total': current_month_plan + next_month_1_plan + next_month_2_plan,
        'month_names': month_names
    }



# API Routes
@app.route('/')
def index():
    """Главная страница - отдаем React приложение"""
    return render_template('index.html')


@app.route('/api/health', methods=['GET'])
def health_check():
    """Проверка здоровья API"""
    return jsonify({
        "status": "healthy",
        "message": "Flask + React app is running!",
        "environment": "production" if not app.debug else "development"
    })


# Аутентификация
@app.route('/api/auth/login', methods=['POST'])
def login():
    """Эндпоинт для входа пользователя"""
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({"success": False, "error": "Логин и пароль обязательны"}), 400

        # Ищем пользователя в базе
        user = User.query.filter_by(username=username, is_active=True).first()

        if user and user.check_password(password):
            # Сохраняем пользователя в сессии
            session['user_id'] = user.id
            session['username'] = user.username
            session['role'] = user.role

            return jsonify({
                "success": True,
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "role": user.role,
                    "name": user.username
                }
            })

        return jsonify({"success": False, "error": "Неверные учетные данные"}), 401

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/auth/logout', methods=['POST'])
def logout():
    """Эндпоинт для выхода пользователя"""
    session.clear()
    return jsonify({"success": True, "message": "Успешный выход"})


@app.route('/api/auth/current', methods=['GET'])
def get_current_user():
    """Получить текущего пользователя"""
    user_id = session.get('user_id')
    if user_id:
        user = db.session.get(User, user_id)
        if user and user.is_active:
            return jsonify({
                "id": user.id,
                "username": user.username,
                "role": user.role,
                "name": user.username
            })

    # Возвращаем null вместо ошибки, если пользователь не авторизован
    return jsonify(None)


@app.route('/api/auth/register', methods=['POST'])
def register():
    """Регистрация нового пользователя (только для определенных ролей)"""
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        role = data.get('role', 'Экономика')

        if not username or not password:
            return jsonify({"success": False, "error": "Логин и пароль обязательны"}), 400

        # Проверяем допустимость роли
        allowed_roles = ['Экономика', 'ПТС', 'Кап. строй', 'МЭС', 'Администратор системы']
        if role not in allowed_roles:
            return jsonify({"success": False, "error": "Недопустимая роль пользователя"}), 400

        # Проверяем, существует ли пользователь
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            return jsonify({"success": False, "error": "Пользователь с таким логином уже существует"}), 400

        # Создаем нового пользователя
        new_user = User(username=username, role=role)
        new_user.set_password(password)

        db.session.add(new_user)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Пользователь успешно создан",
            "user": new_user.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/auth/is-admin', methods=['GET'])
def check_admin():
    """Проверка, является ли пользователь администратором"""
    try:
        user_id = session.get('user_id')
        if user_id:
            user = db.session.get(User, user_id)
            if user and user.is_active:
                # Считаем администратором пользователя с username 'admin'
                # ИЛИ пользователя с ролью 'admin'
                is_admin = user.username == 'admin' or user.role == 'Администратор системы'
                return jsonify({
                    "is_admin": is_admin,
                    "username": user.username
                })

        # Если не авторизован - не администратор
        return jsonify({"is_admin": False})
    except Exception as e:
        return jsonify({"is_admin": False, "error": str(e)}), 500


# Получить всех пользователей
@app.route('/api/auth/users', methods=['GET'])
def get_users():
    try:
        users = User.query.all()
        return jsonify([user.to_dict() for user in users])
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Обновить пользователя
@app.route('/api/auth/users/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    try:
        user = db.session.get(User, user_id)
        if not user:
            return jsonify({'error': 'Пользователь не найден'}), 404

        data = request.get_json()

        if 'username' in data:
            user.username = data['username']
        if 'role' in data:
            user.role = data['role']
        if 'password' in data and data['password']:
            user.set_password(data['password'])

        db.session.commit()

        return jsonify({
            'message': 'Пользователь обновлен',
            'user': user.to_dict()
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Ошибка при обновлении пользователя: {str(e)}'}), 500


# Удалить пользователя (мягкое удаление)
@app.route('/api/auth/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    try:
        user = db.session.get(User, user_id)
        if not user:
            return jsonify({'error': 'Пользователь не найден'}), 404

        # Мягкое удаление - деактивируем пользователя
        user.is_active = False
        db.session.commit()

        return jsonify({'message': 'Пользователь деактивирован'})

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Ошибка при удалении пользователя: {str(e)}'}), 500


@app.route('/api/income', methods=['GET'])
def get_income_contracts():
    try:
        contracts = IncomeContract.query.filter(IncomeContract.deleted_at.is_(None)).all()
        result = []
        for contract in contracts:
            result.append({
                'id': contract.id,
                'contract': contract.contract_number,
                'date': contract.contract_date.strftime('%Y-%m-%d'),
                'client': contract.client,
                'amount': format_currency(contract.contract_amount),
                'paid': format_currency(contract.paid_amount)
            })
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/planning', methods=['GET'])
def get_planning_contracts():
    try:
        contracts = ExpenseContract.query.filter(ExpenseContract.deleted_at.is_(None)).all()
        result = []

        # Получаем названия месяцев один раз для всех договоров
        current_date = datetime.now()
        current_month = current_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        next_month_1 = (current_month.replace(day=28) + timedelta(days=4)).replace(day=1)
        next_month_2 = (next_month_1.replace(day=28) + timedelta(days=4)).replace(day=1)

        month_names = {
            'current_month': current_month.strftime('%B %Y'),
            'next_month_1': next_month_1.strftime('%B %Y'),
            'next_month_2': next_month_2.strftime('%B %Y')
        }

        for contract in contracts:
            planning_data = get_planning_data(contract.cal_plans)

            result.append({
                'id': contract.id,
                'type_contract': contract.type_contract,
                'contract': contract.contract_number,
                'client': contract.client,
                'start_date': contract.start_date.strftime('%Y-%m-%d'),
                'end_date': contract.end_date.strftime('%Y-%m-%d'),
                'name': contract.name,
                'contract_amount': format_currency(contract.contract_amount),
                'advance': f"{contract.advance_percentage}%" if contract.advance_percentage else '',
                'advance_amount': format_currency(
                    calculate_advance_amount(contract.contract_amount, contract.advance_percentage)),
                'current_month': format_currency(planning_data['current_month']),
                'next_month_1': format_currency(planning_data['next_month_1']),
                'next_month_2': format_currency(planning_data['next_month_2']),
                'three_month_total': format_currency(planning_data['three_month_total']),
                'month_names': month_names  # Добавляем названия месяцев
            })
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/actual', methods=['GET'])
def get_actual_contracts():
    try:
        contracts = ExpenseContract.query.filter(ExpenseContract.deleted_at.is_(None)).all()
        result = []
        for contract in contracts:
            contractor_costs = calculate_contractor_costs(contract.cost_items)
            balance = calculate_balance(contract.payment_loesk, contractor_costs)
            remaining_funding = calculate_remaining_funding(contract.contract_amount, contract.payment_loesk)

            # Рассчитываем сумму закрытых работ
            closed_works_total = Decimal('0')
            for work in contract.closed_works:
                closed_works_total += work.amount

            result.append({
                'id': contract.id,
                'type_contract': contract.type_contract,
                'contract': contract.contract_number,
                'client': contract.client,
                'start_date': contract.start_date.strftime('%Y-%m-%d'),
                'end_date': contract.end_date.strftime('%Y-%m-%d'),
                'name': contract.name,
                'contract_amount': format_currency(contract.contract_amount),
                'advance': f"{contract.advance_percentage}%" if contract.advance_percentage else '',
                'payment_loesk': format_currency(contract.payment_loesk),
                'contractor_costs': format_currency(contractor_costs),
                'closed_works': format_currency(closed_works_total),  # Теперь это сумма всех актов КС
                'balance': format_currency(balance),
                'remaining_funding': format_currency(remaining_funding)
            })
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/init-data', methods=['POST'])
def init_test_data():
    try:
        print("Начало создания тестовых данных...")

        # Очистка существующих данных в правильном порядке
        print("Очистка старых данных...")
        db.session.query(CostItem).delete()
        db.session.query(CalPlan).delete()
        db.session.query(ExpenseContract).delete()
        db.session.query(IncomeContract).delete()
        db.session.query(User).delete()

        db.session.commit()
        print("Старые данные очищены")

        # Создание тестовых пользователей
        print("Создание пользователей...")
        users = [
            User(username='economist', role='Экономика'),
            User(username='pts', role='ПТС'),
            User(username='kapstroy', role='Кап. строй'),
            User(username='mes', role='МЭС'),
            User(username='admin', role='Администратор системы')
        ]

        for user in users:
            user.set_password('123')
            db.session.add(user)

        db.session.commit()
        print("Пользователи созданы")

        # Создание доходных договоров
        print("Создание доходных договоров...")
        income_contracts = [
            IncomeContract(
                contract_number='ДГ-001-24',
                contract_date=datetime(2024, 1, 15),
                client='ООО "Ромашка"',
                contract_amount=Decimal('5000000.00'),
                paid_amount=Decimal('5000000.00')
            ),
            IncomeContract(
                contract_number='ДГ-002-24',
                contract_date=datetime(2024, 1, 20),
                client='ИП Сидоров',
                contract_amount=Decimal('3000000.00'),
                paid_amount=Decimal('3000000.00')
            ),
            IncomeContract(
                contract_number='ДГ-003-24',
                contract_date=datetime(2024, 1, 25),
                client='ОАО "Вектор"',
                contract_amount=Decimal('7500000.00'),
                paid_amount=Decimal('3000000.00')
            )
        ]

        for contract in income_contracts:
            db.session.add(contract)

        db.session.commit()
        print("Доходные договоры созданы")

        # Создание расходных договоров
        print("Создание расходных договоров...")
        expense_contracts = []

        contract_data = [
            {
                'number': 'РД-001-24',
                'type_contract': 'ремонтная программа',
                'start_date': datetime(2024, 1, 10),
                'end_date': datetime(2024, 6, 10),
                'name': 'Строительство офисного здания',
                'client': 'ООО "СтройМонтаж"',
                'amount': Decimal('2500000.00'),
                'advance': Decimal('50.00'),
                'payment': Decimal('1800000.00'),
                'income_id': income_contracts[0].id,
                'is_mes': False
            },
            {
                'number': 'РД-002-24',
                'type_contract': 'инвестиционная программа',
                'start_date': datetime(2024, 2, 1),
                'end_date': datetime(2024, 8, 1),
                'name': 'Реконструкция складского помещения',
                'client': 'ООО "РемонтСервис"',
                'amount': Decimal('1800000.00'),
                'advance': Decimal('0.00'),
                'payment': Decimal('1200000.00'),
                'income_id': income_contracts[0].id,
                'is_mes': False
            },
            {
                'number': 'РД-003-24',
                'type_contract': 'ремонтная программа',
                'start_date': datetime(2024, 1, 15),
                'end_date': datetime(2024, 7, 15),
                'name': 'Монтаж инженерных систем',
                'client': 'ООО "ИнжСистемы"',
                'amount': Decimal('3200000.00'),
                'advance': Decimal('10.00'),
                'payment': Decimal('2000000.00'),
                'income_id': income_contracts[1].id,
                'is_mes': False
            }
        ]

        for data in contract_data:
            try:
                contract = ExpenseContract(
                    contract_number=data['number'],
                    type_contract=data['type_contract'],
                    start_date=data['start_date'],
                    end_date=data['end_date'],
                    name=data['name'],
                    client=data['client'],
                    contract_amount=data['amount'],
                    advance_percentage=data['advance'],
                    payment_loesk=data['payment'],
                    income_contract_id=data['income_id']
                )
                db.session.add(contract)
                expense_contracts.append(contract)
                print(f"Создан расходный договор: {data['number']}")
            except Exception as e:
                print(f"Ошибка при создании договора {data['number']}: {str(e)}")
                raise

        db.session.commit()
        print("Расходные договоры созданы")

        # Создание данных для CalPlan
        print("Создание планов...")
        cal_plans = []
        plan_data = [
            # Для РД-001-24
            (0, datetime(2024, 3, 1), Decimal('300000.00')),
            (0, datetime(2024, 4, 1), Decimal('400000.00')),
            (0, datetime(2024, 5, 1), Decimal('350000.00')),
            # Для РД-002-24
            (1, datetime(2024, 3, 1), Decimal('200000.00')),
            (1, datetime(2024, 4, 1), Decimal('250000.00')),
            (1, datetime(2024, 5, 1), Decimal('180000.00')),
            # Для РД-003-24
            (2, datetime(2024, 3, 1), Decimal('450000.00')),
            (2, datetime(2024, 4, 1), Decimal('500000.00')),
            (2, datetime(2024, 5, 1), Decimal('480000.00')),
        ]

        for contract_idx, date, amount in plan_data:
            plan = CalPlan(
                iddog=expense_contracts[contract_idx].id,
                date=date,
                plopl=amount
            )
            db.session.add(plan)
            cal_plans.append(plan)

        db.session.commit()
        print("Планы созданы")

        # Создание данных для CostItem
        print("Создание затрат...")
        cost_items = []
        cost_data = [
            # Для РД-001-24
            (0, datetime(2024, 1, 20), 'ООО "СтройМонтаж"', 'Материалы', 'Закупка строительных материалов',
             Decimal('800000.00')),
            (0, datetime(2024, 2, 15), 'ИП Петров', 'Работы', 'Монтажные работы', Decimal('400000.00')),
            # Для РД-002-24
            (1, datetime(2024, 2, 10), 'ООО "РемонтСервис"', 'Материалы', 'Закупка отделочных материалов',
             Decimal('500000.00')),
            (1, datetime(2024, 3, 5), 'ИП Сидоров', 'Работы', 'Отделочные работы', Decimal('400000.00')),
            # Для РД-003-24
            (2, datetime(2024, 1, 25), 'ООО "ИнжСистемы"', 'Оборудование', 'Закупка инженерного оборудования',
             Decimal('1000000.00')),
            (2, datetime(2024, 2, 20), 'ИП Козлов', 'Работы', 'Монтаж систем', Decimal('500000.00')),
        ]

        for contract_idx, date, kontragent, category, purpose, amount in cost_data:
            cost_item = CostItem(
                contract_id=expense_contracts[contract_idx].id,
                date=date,
                kontragent=kontragent,
                category=category,
                purpose=purpose,
                amount=amount
            )
            db.session.add(cost_item)
            cost_items.append(cost_item)

        db.session.commit()
        print("Все тестовые данные успешно созданы!")

        return jsonify({
            'message': 'Тестовые данные успешно созданы',
            'count': {
                'users': len(users),
                'income_contracts': len(income_contracts),
                'expense_contracts': len(expense_contracts),
                'cal_plans': len(cal_plans),
                'cost_items': len(cost_items)
            }
        })

    except Exception as e:
        db.session.rollback()
        print(f"КРИТИЧЕСКАЯ ОШИБКА: {str(e)}")
        import traceback
        print(f"Трассировка: {traceback.format_exc()}")
        return jsonify({'error': f'Ошибка при создании тестовых данных: {str(e)}'}), 500


@app.route('/api/income-contracts', methods=['POST'])
def create_income_contract():
    try:
        data = request.get_json()

        # Валидация обязательных полей
        required_fields = ['contract_number', 'contract_date', 'client', 'contract_amount']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'Поле {field} обязательно для заполнения'}), 400

        # Проверка уникальности номера договора
        existing_contract = IncomeContract.query.filter_by(contract_number=data['contract_number']).first()
        if existing_contract:
            return jsonify({'error': 'Договор с таким номером уже существует'}), 400

        # Создание нового доходного договора
        new_contract = IncomeContract(
            contract_number=data['contract_number'],
            contract_date=datetime.strptime(data['contract_date'], '%Y-%m-%d'),
            client=data['client'],
            contract_amount=Decimal(data['contract_amount']),
            paid_amount=Decimal(data.get('paid_amount', 0)),
            status='active'
        )

        db.session.add(new_contract)
        db.session.commit()

        return jsonify({
            'message': 'Доходный договор успешно создан',
            'contract': {
                'id': new_contract.id,
                'contract_number': new_contract.contract_number,
                'contract_date': new_contract.contract_date.strftime('%Y-%m-%d'),
                'client': new_contract.client,
                'contract_amount': format_currency(new_contract.contract_amount),
                'paid_amount': format_currency(new_contract.paid_amount)
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Ошибка при создании договора: {str(e)}'}), 500


@app.route('/api/expense-contracts', methods=['POST'])
def create_expense_contract():
    try:
        data = request.get_json()

        # Валидация обязательных полей
        required_fields = [
            'contract_number', 'start_date', 'end_date',
            'name', 'contract_amount', 'type_contract', 'funding_source', 'client'
        ]
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'Поле {field} обязательно для заполнения'}), 400

        # Проверка уникальности номера договора
        existing_contract = db.session.execute(
            db.select(ExpenseContract).filter_by(contract_number=data['contract_number'])
        ).scalar_one_or_none()

        if existing_contract:
            return jsonify({'error': 'Договор с таким номером уже существует'}), 400

        # Проверка существования и активности доходного договора
        income_contract = IncomeContract.query.filter(
            IncomeContract.id == data['funding_source'],
            IncomeContract.status == 'active',
            IncomeContract.deleted_at.is_(None)
        ).first()

        if not income_contract:
            return jsonify({'error': 'Указанный источник финансирования не найден или не активен'}), 400

        # Создание нового расходного договора
        new_contract = ExpenseContract(
            contract_number=data['contract_number'],
            type_contract=data['type_contract'],
            start_date=datetime.strptime(data['start_date'], '%Y-%m-%d'),
            end_date=datetime.strptime(data['end_date'], '%Y-%m-%d'),
            name=data['name'],
            client=data['client'],  # Контрагент
            contract_amount=Decimal(data['contract_amount']),
            advance_percentage=Decimal(data.get('advance_percentage', 0)),
            payment_loesk=Decimal(0),
            income_contract_id=data['funding_source'],
            is_mes=data.get('is_mes', False),  # Новое поле
            status='active'
        )

        db.session.add(new_contract)
        db.session.commit()

        return jsonify({
            'message': 'Расходный договор успешно создан',
            'contract': {
                'id': new_contract.id,
                'contract_number': new_contract.contract_number,
                'type_contract': new_contract.type_contract,
                'start_date': new_contract.start_date.strftime('%Y-%m-%d'),
                'end_date': new_contract.end_date.strftime('%Y-%m-%d'),
                'name': new_contract.name,
                'client': new_contract.client,
                'is_mes': new_contract.is_mes,  # Добавляем в ответ
                'contract_amount': format_currency(new_contract.contract_amount),
                'advance_percentage': str(new_contract.advance_percentage),
                'income_contract_id': new_contract.income_contract_id
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Ошибка при создании договора: {str(e)}'}), 500

# Роут для получения списка доходных договоров (для выпадающего списка)
@app.route('/api/income-contracts/options', methods=['GET'])
def get_income_contracts_options():
    try:
        # Фильтруем только активные договоры (не удаленные)
        contracts = IncomeContract.query.filter(
            IncomeContract.status == 'active',
            IncomeContract.deleted_at.is_(None)
        ).all()
        options = [{
            'value': contract.id,
            'label': f'{contract.contract_number} - {contract.client}'
        } for contract in contracts]

        return jsonify(options)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Роут для получения деталей договора
@app.route('/api/income-contracts/<int:contract_id>', methods=['GET'])
def get_income_contract(contract_id):
    try:
        contract = IncomeContract.query.get_or_404(contract_id)
        return jsonify({
            'id': contract.id,
            'contract_number': contract.contract_number,
            'contract_date': contract.contract_date.strftime('%Y-%m-%d'),
            'client': contract.client,
            'contract_amount': str(contract.contract_amount),
            'paid_amount': str(contract.paid_amount),
            'status': contract.status
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 404


# Роут для обновления оплат
@app.route('/api/income-contracts/<int:contract_id>', methods=['PUT'])
def update_income_contract(contract_id):
    try:
        contract = db.session.get(IncomeContract, contract_id)
        if not contract:
            return jsonify({'error': 'Договор не найден'}), 404

        data = request.get_json()

        # Обновляем все поля
        if 'contract_number' in data:
            contract.contract_number = data['contract_number']
        if 'contract_date' in data:
            contract.contract_date = datetime.strptime(data['contract_date'], '%Y-%m-%d')
        if 'client' in data:
            contract.client = data['client']
        if 'contract_amount' in data:
            contract.contract_amount = Decimal(data['contract_amount'])
        if 'paid_amount' in data:
            contract.paid_amount = Decimal(data['paid_amount'])

        db.session.commit()

        return jsonify({
            'message': 'Данные договора обновлены',
            'contract': {
                'id': contract.id,
                'contract_number': contract.contract_number,
                'contract_date': contract.contract_date.strftime('%Y-%m-%d'),
                'client': contract.client,
                'contract_amount': str(contract.contract_amount),
                'paid_amount': str(contract.paid_amount)
            }
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Ошибка при обновлении договора: {str(e)}'}), 500


@app.route('/api/expense-contracts/<int:contract_id>', methods=['GET'])
def get_expense_contract(contract_id):
    try:
        contract = ExpenseContract.query.get_or_404(contract_id)
        return jsonify({
            'id': contract.id,
            'contract_number': contract.contract_number,
            'start_date': contract.start_date.strftime('%Y-%m-%d'),
            'end_date': contract.end_date.strftime('%Y-%m-%d'),
            'name': contract.name,
            'client': contract.client,
            'contract_amount': str(contract.contract_amount),
            'advance_percentage': str(contract.advance_percentage),
            'payment_loesk': str(contract.payment_loesk),
            'type_contract': contract.type_contract,
            'income_contract_id': contract.income_contract_id,
            'status': contract.status
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 404

@app.route('/api/expense-contracts/<int:contract_id>', methods=['PUT'])
def update_expense_contract(contract_id):
    try:
        contract = db.session.get(ExpenseContract, contract_id)
        if not contract:
            return jsonify({'error': 'Договор не найден'}), 404

        data = request.get_json()

        # Если обновляется источник финансирования, проверяем его активность
        if 'income_contract_id' in data:
            income_contract = IncomeContract.query.filter(
                IncomeContract.id == data['income_contract_id'],
                IncomeContract.status == 'active',
                IncomeContract.deleted_at.is_(None)
            ).first()
            if not income_contract:
                return jsonify({'error': 'Указанный источник финансирования не найден или не активен'}), 400

        # Обновляем все поля
        if 'contract_number' in data:
            contract.contract_number = data['contract_number']
        if 'start_date' in data:
            contract.start_date = datetime.strptime(data['start_date'], '%Y-%m-%d')
        if 'end_date' in data:
            contract.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d')
        if 'name' in data:
            contract.name = data['name']
        if 'client' in data:
            contract.client = data['client']
        if 'contract_amount' in data:
            contract.contract_amount = Decimal(data['contract_amount'])
        if 'advance_percentage' in data:
            contract.advance_percentage = Decimal(data['advance_percentage'])
        if 'type_contract' in data:
            contract.type_contract = data['type_contract']
        if 'income_contract_id' in data:
            contract.income_contract_id = data['income_contract_id']
        if 'payment_loesk' in data:
            contract.payment_loesk = Decimal(data['payment_loesk'])

        db.session.commit()

        return jsonify({
            'message': 'Данные договора обновлены',
            'contract': {
                'id': contract.id,
                'contract_number': contract.contract_number,
                'start_date': contract.start_date.strftime('%Y-%m-%d'),
                'end_date': contract.end_date.strftime('%Y-%m-%d'),
                'name': contract.name,
                'client': contract.client,
                'contract_amount': str(contract.contract_amount),
                'advance_percentage': str(contract.advance_percentage),
                'type_contract': contract.type_contract,
                'income_contract_id': contract.income_contract_id,
                'payment_loesk': str(contract.payment_loesk)
            }
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Ошибка при обновлении договора: {str(e)}'}), 500

@app.route('/api/income-contracts/<int:contract_id>', methods=['DELETE'])
def delete_income_contract(contract_id):
    try:
        contract = db.session.get(IncomeContract, contract_id)
        if not contract:
            return jsonify({'error': 'Договор не найден'}), 404

        # Мягкое удаление - устанавливаем время удаления
        contract.deleted_at = datetime.utcnow()
        db.session.commit()

        return jsonify({'message': 'Договор успешно удален'})

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Ошибка при удалении договора: {str(e)}'}), 500


@app.route('/api/expense-contracts/<int:contract_id>', methods=['DELETE'])
def delete_expense_contract(contract_id):
    try:
        contract = db.session.get(ExpenseContract, contract_id)
        if not contract:
            return jsonify({'error': 'Договор не найден'}), 404

        # Мягкое удаление - устанавливаем время удаления
        contract.deleted_at = datetime.utcnow()
        db.session.commit()

        return jsonify({'message': 'Договор успешно удален'})

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Ошибка при удалении договора: {str(e)}'}), 500


# Получить закрытые работы по договору
@app.route('/api/expense-contracts/<int:contract_id>/closed-works', methods=['GET'])
def get_closed_works(contract_id):
    try:
        works = ClosedWork.query.filter_by(contract_id=contract_id).all()
        return jsonify([work.to_dict() for work in works])
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Добавить закрытую работу с файлом
@app.route('/api/expense-contracts/<int:contract_id>/closed-works', methods=['POST'])
def add_closed_work(contract_id):
    try:
        # Проверяем существование договора
        contract = db.session.get(ExpenseContract, contract_id)
        if not contract:
            return jsonify({'error': 'Договор не найден'}), 404

        ensure_upload_folder()

        act_number = request.form.get('act_number')
        act_date = request.form.get('act_date')
        amount = request.form.get('amount')
        file = request.files.get('file')

        if not act_number or not act_date or not amount:
            return jsonify({'error': 'Все обязательные поля должны быть заполнены'}), 400

        new_work = ClosedWork(
            contract_id=contract_id,
            act_number=act_number,
            act_date=datetime.strptime(act_date, '%Y-%m-%d'),
            amount=Decimal(amount)
        )

        # Обработка файла
        if file and file.filename:
            if not allowed_file(file.filename):
                return jsonify({'error': 'Разрешены только PDF файлы'}), 400

            # Проверяем размер файла
            file.seek(0, os.SEEK_END)
            file_size = file.tell()
            file.seek(0)

            if file_size > MAX_FILE_SIZE:
                return jsonify({'error': 'Файл слишком большой. Максимальный размер: 16MB'}), 400

            filename = secure_filename(file.filename)

            # Безопасное получение расширения файла
            if '.' in filename:
                file_extension = filename.rsplit('.', 1)[1].lower()
            else:
                file_extension = 'pdf'  # значение по умолчанию

            # Создаем уникальное имя файла
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            unique_filename = f"contract_{contract_id}_act_{act_number}_{timestamp}.{file_extension}"

            file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            file.save(file_path)

            new_work.file_name = filename
            new_work.file_path = file_path

        db.session.add(new_work)
        db.session.commit()

        return jsonify({
            'message': 'Акт КС успешно добавлен',
            'work': new_work.to_dict()
        })

    except Exception as e:
        db.session.rollback()
        import traceback
        print(f"Ошибка при добавлении акта: {str(e)}")
        print(f"Трассировка: {traceback.format_exc()}")
        return jsonify({'error': f'Ошибка при добавлении акта: {str(e)}'}), 500


# Эндпоинт для скачивания/просмотра файла
@app.route('/api/closed-works/<int:work_id>/file', methods=['GET'])
def get_closed_work_file(work_id):
    try:
        work = db.session.get(ClosedWork, work_id)
        if not work or not work.file_path:
            return jsonify({'error': 'Файл не найден'}), 404

        if not os.path.exists(work.file_path):
            return jsonify({'error': 'Файл не существует на сервере'}), 404

        # Для скачивания отправляем как attachment
        if request.args.get('download'):
            return send_file(work.file_path, as_attachment=True, download_name=work.file_name)
        else:
            # Для просмотра отправляем как inline
            return send_file(work.file_path, mimetype='application/pdf')

    except Exception as e:
        return jsonify({'error': f'Ошибка при загрузке файла: {str(e)}'}), 500


# Обновляем эндпоинт удаления для удаления файлов
@app.route('/api/expense-contracts/<int:contract_id>/closed-works/<int:work_id>', methods=['DELETE'])
def delete_closed_work(contract_id, work_id):
    try:
        work = db.session.get(ClosedWork, work_id)
        if not work or work.contract_id != contract_id:
            return jsonify({'error': 'Акт не найден'}), 404

        # Удаляем файл если он существует
        if work.file_path and os.path.exists(work.file_path):
            try:
                os.remove(work.file_path)
            except OSError as e:
                print(f"Ошибка при удалении файла: {e}")

        db.session.delete(work)
        db.session.commit()

        return jsonify({'message': 'Акт КС успешно удален'})

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Ошибка при удалении акта: {str(e)}'}), 500


# Эндпоинт для добавления файла к существующему акту
@app.route('/api/closed-works/<int:work_id>/file', methods=['POST'])
def add_file_to_closed_work(work_id):
    try:
        work = db.session.get(ClosedWork, work_id)
        if not work:
            return jsonify({'error': 'Акт не найден'}), 404

        ensure_upload_folder()

        file = request.files.get('file')
        if not file or not file.filename:
            return jsonify({'error': 'Файл не предоставлен'}), 400

        if not allowed_file(file.filename):
            return jsonify({'error': 'Разрешены только PDF файлы'}), 400

        # Проверяем размер файла
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)

        if file_size > MAX_FILE_SIZE:
            return jsonify({'error': 'Файл слишком большой. Максимальный размер: 16MB'}), 400

        # Если у акта уже есть файл - удаляем старый
        if work.file_path and os.path.exists(work.file_path):
            try:
                os.remove(work.file_path)
            except OSError as e:
                print(f"Ошибка при удалении старого файла: {e}")

        filename = secure_filename(file.filename)

        # Создаем уникальное имя файла
        if '.' in filename:
            file_extension = filename.rsplit('.', 1)[1].lower()
        else:
            file_extension = 'pdf'

        unique_filename = f"work_{work_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.{file_extension}"

        file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(file_path)

        # Обновляем запись акта
        work.file_name = filename
        work.file_path = file_path
        work.updated_at = datetime.utcnow()

        db.session.commit()

        return jsonify({
            'message': 'Файл успешно добавлен',
            'file_url': f'/api/closed-works/{work.id}/file',
            'file_name': work.file_name
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Ошибка при добавлении файла: {str(e)}'}), 500


# Получить затраты подрядчика
@app.route('/api/expense-contracts/<int:contract_id>/cost-items', methods=['GET'])
def get_cost_items(contract_id):
    try:
        cost_items = CostItem.query.filter_by(contract_id=contract_id).all()
        result = []
        for item in cost_items:
            result.append({
                'id': item.id,
                'date': item.date.strftime('%Y-%m-%d'),
                'kontragent': item.kontragent,
                'category': item.category,
                'purpose': item.purpose,
                'amount': str(item.amount)
            })
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Добавить затрату подрядчика
@app.route('/api/expense-contracts/<int:contract_id>/cost-items', methods=['POST'])
def add_cost_item(contract_id):
    try:
        # Проверяем существование договора
        contract = db.session.get(ExpenseContract, contract_id)
        if not contract:
            return jsonify({'error': 'Договор не найден'}), 404

        data = request.get_json()

        # Валидация обязательных полей
        required_fields = ['date', 'kontragent', 'category', 'purpose', 'amount']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'Поле {field} обязательно для заполнения'}), 400

        new_cost_item = CostItem(
            contract_id=contract_id,
            date=datetime.strptime(data['date'], '%Y-%m-%d'),
            kontragent=data['kontragent'],
            category=data['category'],
            purpose=data['purpose'],
            amount=Decimal(data['amount'])
        )

        db.session.add(new_cost_item)
        db.session.commit()

        return jsonify({
            'message': 'Платеж успешно добавлен',
            'cost_item': {
                'id': new_cost_item.id,
                'date': new_cost_item.date.strftime('%Y-%m-%d'),
                'kontragent': new_cost_item.kontragent,
                'category': new_cost_item.category,
                'purpose': new_cost_item.purpose,
                'amount': str(new_cost_item.amount)
            }
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Ошибка при добавлении платежа: {str(e)}'}), 500


# Удалить затрату подрядчика
@app.route('/api/expense-contracts/<int:contract_id>/cost-items/<int:item_id>', methods=['DELETE'])
def delete_cost_item(contract_id, item_id):
    try:
        cost_item = db.session.get(CostItem, item_id)
        if not cost_item or cost_item.contract_id != contract_id:
            return jsonify({'error': 'Платеж не найден'}), 404

        db.session.delete(cost_item)
        db.session.commit()

        return jsonify({'message': 'Платеж успешно удален'})

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Ошибка при удалении платежа: {str(e)}'}), 500


# Получить календарный план
@app.route('/api/expense-contracts/<int:contract_id>/cal-plan', methods=['GET'])
def get_cal_plan(contract_id):
    try:
        plans = CalPlan.query.filter_by(iddog=contract_id).all()
        result = []
        for plan in plans:
            result.append({
                'id': plan.id,
                'date': plan.date.strftime('%Y-%m-%d'),
                'plopl': str(plan.plopl)
            })
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Сохранить календарный план
@app.route('/api/expense-contracts/<int:contract_id>/cal-plan', methods=['POST'])
def save_cal_plan(contract_id):
    try:
        data = request.get_json()
        plans = data.get('plans', [])

        # Удаляем старые планы
        CalPlan.query.filter_by(iddog=contract_id).delete()

        # Сохраняем новые планы
        for plan_data in plans:
            plan = CalPlan(
                iddog=contract_id,
                date=datetime.strptime(plan_data['date'], '%Y-%m-%d'),
                plopl=Decimal(plan_data['plopl'])
            )
            db.session.add(plan)

        db.session.commit()

        return jsonify({
            'message': 'План финансирования успешно сохранен',
            'saved_plans': len(plans)
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Ошибка при сохранении плана: {str(e)}'}), 500


@app.route('/api/balance', methods=['GET'])
def get_balance_data():
    try:
        # Загружаем все доходные договоры
        income_contracts = IncomeContract.query.filter(IncomeContract.deleted_at.is_(None)).all()

        # Загружаем все расходные договоры
        expense_contracts = ExpenseContract.query.filter(ExpenseContract.deleted_at.is_(None)).all()

        result = []
        total_balance = Decimal('0')

        for income in income_contracts:
            # Находим связанные расходные договоры
            related_expenses = [exp for exp in expense_contracts if exp.income_contract_id == income.id]

            total_income = income.contract_amount
            total_expense = sum(exp.contract_amount for exp in related_expenses)
            total_paid = sum(exp.payment_loesk for exp in related_expenses)

            contract_balance = (income.paid_amount or Decimal('0')) - total_paid

            result.append({
                'income_contract': {
                    'id': income.id,
                    'number': income.contract_number,
                    'client': income.client,
                    'amount': str(total_income),
                    'paid': str(income.paid_amount or Decimal('0'))
                },
                'expense_contracts': [{
                    'id': exp.id,
                    'number': exp.contract_number,
                    'amount': str(exp.contract_amount),
                    'paid': str(exp.payment_loesk or Decimal('0'))
                } for exp in related_expenses],
                'total_expense': str(total_expense),
                'total_paid': str(total_paid),
                'balance': str(contract_balance)
            })

            total_balance += contract_balance

        return jsonify({
            'contracts': result,
            'total_balance': str(total_balance)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5002)