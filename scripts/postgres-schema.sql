-- ============================================================================
-- Sinergia Meet - Base de Datos Relacional PostgreSQL (Producción)
-- Empresa: Sinergia Agencia Creativa SAS
-- Dominio: sinergiameet.com
-- ============================================================================

-- Habilitar extensiones requeridas para generación de UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA: Usuarios
CREATE TYPE user_role AS ENUM ('USER', 'ADMIN', 'ENTERPRISE');
CREATE TYPE user_status AS ENUM ('ACTIVE', 'PENDING', 'SUSPENDED');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'USER'::user_role NOT NULL,
    status user_status DEFAULT 'PENDING'::user_status NOT NULL,
    avatar_url VARCHAR(512),
    refresh_token VARCHAR(512),
    email_verified BOOLEAN DEFAULT FALSE NOT NULL,
    activation_token VARCHAR(255),
    reset_token VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexar correos para accesos ultrarrápidos
CREATE INDEX idx_users_email ON users(email);

-- 2. TABLA: Equipos
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Relación N a M: Miembros de Equipo
CREATE TABLE team_members (
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (team_id, user_id)
);

-- 3. TABLA: Reuniones (Meetings)
CREATE TYPE meeting_status AS ENUM ('SCHEDULED', 'LIVE', 'ENDED');

CREATE TABLE meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    password_hash VARCHAR(255), -- Contraseña opcional de ingreso
    status meeting_status DEFAULT 'SCHEDULED'::meeting_status NOT NULL,
    waiting_room_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    max_participants INTEGER DEFAULT 100 NOT NULL,
    scheduled_for TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_meetings_host_id ON meetings(host_id);
CREATE INDEX idx_meetings_status ON meetings(status);

-- 4. TABLA: Participantes (En Tiempo Real)
CREATE TYPE participant_role AS ENUM ('HOST', 'PRESENTER', 'ATTENDEE');

CREATE TABLE participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL, -- Para invitados externos sin registrar
    role participant_role DEFAULT 'ATTENDEE'::participant_role NOT NULL,
    is_muted BOOLEAN DEFAULT FALSE NOT NULL,
    is_video_off BOOLEAN DEFAULT FALSE NOT NULL,
    hand_raised BOOLEAN DEFAULT FALSE NOT NULL,
    is_in_waiting_room BOOLEAN DEFAULT FALSE NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    left_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_participants_meeting ON participants(meeting_id);
CREATE INDEX idx_participants_user ON participants(user_id);

-- 5. TABLA: Mensajes de Chat
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    sender_name VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    sender_ip VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_chat_messages_meeting ON chat_messages(meeting_id);

-- 6. TABLA: Sinergia Wallet (Billetera Digital Integrada)
CREATE TYPE wallet_status AS ENUM ('ACTIVE', 'FROZEN');

CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance DECIMAL(15, 4) DEFAULT 0.0000 NOT NULL CHECK (balance >= 0),
    currency VARCHAR(3) DEFAULT 'USD' NOT NULL,
    status wallet_status DEFAULT 'ACTIVE'::wallet_status NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 7. TABLA: Transacciones de Sinergia Wallet (Auditoría Completa)
CREATE TYPE transaction_type AS ENUM ('DEPOSIT', 'WITHDRAW', 'TRANSFER_IN', 'TRANSFER_OUT', 'FEE', 'REFUND');
CREATE TYPE transaction_status AS ENUM ('COMPLETED', 'PENDING', 'FAILED', 'BLOCKED');

CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    type transaction_type NOT NULL,
    amount DECIMAL(15, 4) NOT NULL CHECK (amount > 0),
    description VARCHAR(255) NOT NULL,
    reference_id VARCHAR(100), -- ID de Stripe, MercadoPago, etc.
    recipient_email VARCHAR(255), -- Para transferencias directas
    status transaction_status DEFAULT 'PENDING'::transaction_status NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    anti_fraud_flag BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_wallet_tx_wallet_id ON wallet_transactions(wallet_id);

-- 8. TABLA: Planes y Suscripciones SaaS
CREATE TYPE plan_code AS ENUM ('FREE', 'PROFESSIONAL', 'ENTERPRISE');
CREATE TYPE subscription_status AS ENUM ('ACTIVE', 'CANCELED', 'EXPIRED');

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_code plan_code DEFAULT 'FREE'::plan_code NOT NULL,
    status subscription_status DEFAULT 'ACTIVE'::subscription_status NOT NULL,
    billing_period VARCHAR(20) DEFAULT 'MONTHLY' NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);

-- 9. TABLA: Facturas y Comprobantes de Pago
CREATE TYPE gateway_type AS ENUM ('STRIPE', 'PAYPAL', 'MERCADOPAGO', 'WOMPI', 'WALLET');
CREATE TYPE invoice_status AS ENUM ('PAID', 'PENDING', 'FAILED');

CREATE TABLE payment_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    gateway gateway_type NOT NULL,
    status invoice_status DEFAULT 'PENDING'::invoice_status NOT NULL,
    plan_code plan_code NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    invoice_pdf_url VARCHAR(512)
);

-- 10. TABLA: Transcripciones e IA
CREATE TABLE meeting_transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID UNIQUE NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    speech_text TEXT NOT NULL,
    summary TEXT,
    tasks JSONB, -- listado de tareas asignadas generadas por IA
    minutes TEXT, -- acta formal de la reunión por IA
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 11. TABLA: Logs de Auditoría General (Ciberseguridad OWASP)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent VARCHAR(512) NOT NULL,
    details TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'INFO' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_severity ON audit_logs(severity);


-- ============================================================================
-- DISPARADORES (TRIGGERS) PARA AUDITORÍA Y SEGURIDAD DE SALDO (ANTI-FRAUDE)
-- ============================================================================

-- Automatización para actualización de actualizacion de Wallet Balance
CREATE OR REPLACE FUNCTION update_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'COMPLETED' AND OLD.status != 'COMPLETED' THEN
        IF NEW.type IN ('DEPOSIT', 'TRANSFER_IN', 'REFUND') THEN
            UPDATE wallets SET balance = balance + NEW.amount, updated_at = NOW() WHERE id = NEW.wallet_id;
        ELSIF NEW.type IN ('WITHDRAW', 'TRANSFER_OUT', 'FEE') THEN
            UPDATE wallets SET balance = balance - NEW.amount, updated_at = NOW() WHERE id = NEW.wallet_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_wallet_balance
AFTER UPDATE OF status ON wallet_transactions
FOR EACH ROW
EXECUTE FUNCTION update_wallet_balance();
