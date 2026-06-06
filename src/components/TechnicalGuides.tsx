/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  FileText, GitFork, Server, Database, Play, 
  BookOpen, Terminal, Code, HelpCircle 
} from 'lucide-react';

export default function TechnicalGuides() {
  return (
    <div className="space-y-8 animate-fade-in" id="technical-guides">
      
      {/* Title */}
      <div className="pb-2 border-b border-slate-200">
        <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-[#3B82F6]" /> Manuales Técnicos y de Usuario de Sinergia Meet
        </h2>
        <p className="text-xs text-slate-500">Todo acerca del diseño de software, diagramas, arquitectura DDD y roadmap del ecosistema Sinergia.</p>
      </div>

      {/* Grid of guides */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-slate-800">
        
        {/* DDD & Clean Architecture layout */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-sm border-l-4 border-l-[#3B82F6]">
          <h3 className="text-sm font-bold font-mono text-slate-700 flex items-center gap-1.5 uppercase">
            <GitFork className="w-4 h-4 text-blue-500" /> Arquitectura Limpia (Clean Architecture + DDD)
          </h3>
          
          <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
            <p>La plataforma está estructurada siguiendo los principios de acoplamiento débil de <strong>Clean Architecture</strong>, separando las operaciones industriales en capas con flujos de dependencia hacia el núcleo:</p>
            <ul className="space-y-2 list-none bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-600">
              <li><strong className="text-slate-900 font-semibold">• Domain/Core:</strong> Entidades puras y de comportamiento aisladas (ej. Billetera Sinergia Wallet, Reuniones) que no dependen de ningún software externo.</li>
              <li><strong className="text-slate-900 font-semibold">• Use Cases:</strong> Acciones de nivel ejecutivo como emitir depósitos, liquidar transferencias, o convocar reuniones utilizando el patrón CQRS.</li>
              <li><strong className="text-slate-900 font-semibold">• Repositories:</strong> Interfaces de persistencia que aseguran que el acceso a datos sea intercambiable entre base de datos Postgres y otros motores.</li>
              <li><strong className="text-slate-900 font-semibold">• Infrastructure:</strong> Módulo Express, driver PostgreSQL, pasarelas SSL (Stripe, Paypal), S3 MinIO y el SDK Co-piloto Gemini.</li>
            </ul>
          </div>
        </div>

        {/* Database ER Model */}
        <div className="p-6 rounded-2xl bg-white border border-slate-205 space-y-4 shadow-sm">
          <h3 className="text-sm font-bold font-mono text-slate-700 flex items-center gap-1.5 uppercase">
            <Database className="w-4 h-4 text-blue-500" /> Modelo Entidad-Relación (Relational ER Diagram)
          </h3>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono text-[10px] text-slate-600 overflow-x-auto max-h-60">
            <pre className="text-slate-700 whitespace-pre">
{`+------------------------------+
|            USERS             |
+------------------------------+
| id (UUID, PK)                | <------+
| name (VARCHAR)               |        |
| email (VARCHAR, UNIQUE)      |        |
| role (user_role)             |        |
| status (user_status)         |        |
+------------------------------+        |
       |                                |
       | 1                              |
       v N                              | 1
+------------------------------+        |
|          MEETINGS            |        |
+------------------------------+        |
| id (UUID, PK)                | <----+ |
| title (VARCHAR)              |      | |
| host_id (UUID, FK)           |      | |
| wait_room_enabled (BOOL)     |      | |
| status (meeting_status)      |      | |
+------------------------------+      | |
       |                              | |
       | 1                            | |
       v N                            | |
+------------------------------+      | |
|         PARTICIPANTS         |      | |
+------------------------------+      | |
| id (UUID, PK)                |      | |
| meeting_id (UUID, FK) -------+      | |
| user_id (UUID, FK) -----------------+ |
| name (VARCHAR)               |        |
| role (participant_role)      |        |
+------------------------------+        |
       |                                |
       | 1                              |
       v 1                              |
+------------------------------+        |
|     MEETING_TRANSCRIPTS      |        |
+------------------------------+        |
| id (UUID, PK)                |        |
| meeting_id (UUID, FK) -------+        |
| speech_text (TEXT)           |        |
| summary (TEXT)               |        |
| tasks (JSONB, Acciones)      |        |
+------------------------------+        |
                                        |
+------------------------------+        |
|           WALLETS            |        |
+------------------------------+        |
| id (UUID, PK)                |        |
| user_id (UUID, FK) ----------+        |
| balance (DECIMAL)            | <----+ |
| status (wallet_status)       |      | |
+------------------------------+      | |
       |                              | |
       | 1                            | |
       v N                            | |
+------------------------------+      | |
|     WALLET_TRANSACTIONS      |      | |
+------------------------------+      | |
| id (UUID, PK)                |      | |
| wallet_id (UUID, FK) --------+      | |
| type (transaction_type)      |        |
| amount (DECIMAL)             |        |
+------------------------------+        |`}
            </pre>
          </div>
        </div>

        {/* Technical installation guide / commands */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-sm">
          <h3 className="text-sm font-bold font-mono text-slate-700 flex items-center gap-1.5 uppercase">
            <Terminal className="w-4 h-4 text-blue-500" /> Hoja de Ruta de Escalabilidad Corporativa
          </h3>

          <div className="text-xs text-slate-650 space-y-3.5 leading-relaxed">
            <p>Sinergia Meet está preparado técnicamente para transformarse de un único módulo SaaS hacia un gran portal coordinado (Workspace) utilizando:</p>
            <ol className="list-decimal list-inside space-y-2.5 bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-600">
              <li><strong className="text-slate-800">Sinergia Wallet a Sinergia Pay:</strong> Conversión del monedero del usuario en una red de API abierta de Checkout que terceros comercios puedan incorporar.</li>
              <li><strong className="text-slate-800">Infraestructura WebRTC Elástica:</strong> Agregar servidores SFU (Selective Forwarding Unit) como Mediasoup desplegados bajo clústeres auto-elásticos de Kubernetes para llamadas de alta densidad para más de 1000 usuarios en simultáneo.</li>
              <li><strong className="text-slate-800">Sinergia Workspace:</strong> Incorporar gestores de documentos en línea, almacenamiento en la nube compatible con S3 directo por usuario, y mensajería corporativa.</li>
            </ol>
          </div>
        </div>

        {/* User Manual Guidelines */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-sm border-l-4 border-l-emerald-500">
          <h3 className="text-sm font-bold font-mono text-slate-700 flex items-center gap-1.5 uppercase">
            <BookOpen className="w-4 h-4 text-emerald-600" /> Manual de Uso de la Plataforma
          </h3>

          <div className="text-xs text-slate-600 space-y-3.5 leading-relaxed">
            <h5 className="font-bold text-slate-900">¿Cómo operar el Co-piloto de Inteligencia Artificial?</h5>
            <p>
              1. Conéctate a una videoconferencia activa de Sinergia Meet mediante el panel general de Inicio.
            </p>
            <p>
              2. Nuestro Co-piloto acumula fragmentos del diálogo de voz en tiempo real. Puedes simular diálogos enviando mensajes de audio y chat en el canal.
            </p>
            <p>
              3. Presiona el botón <strong>"Generar Resumen Técnica AI"</strong>. Se invocará al motor server-side de Gemini 2.5 Flash, extrayendo un análisis de contexto que te devolverá el acta, tareas y resumen exactos de forma inmediata.
            </p>
            <h5 className="font-bold text-slate-900 mt-2">¿Cómo usar Sinergia Wallet?</h5>
            <p>
              Recarga tu billetera e ingresa el email de cualquier otro usuario de Sinergia para transferir fondos instantáneamente con total seguridad, bajo el cobro protegido del motor antifraude.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
