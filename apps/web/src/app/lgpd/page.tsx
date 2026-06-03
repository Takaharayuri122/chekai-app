import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ScrollText, UserCheck, FileText, Scale, Mail, ListChecks } from 'lucide-react';

export const metadata: Metadata = {
  title: 'LGPD - ChekAI',
  description:
    'Lei Geral de Proteção de Dados (LGPD) no ChekAI — bases legais, direitos do titular e como exercê-los.',
};

export default function LgpdPage() {
  return (
    <div className="min-h-screen bg-base-200">
      <div className="bg-base-100 border-b border-base-300">
        <div className="max-w-4xl mx-auto px-4 py-4 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-base-content/70 hover:text-primary transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para a página inicial
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold text-base-content mb-2 flex items-center gap-3">
            <Scale className="w-8 h-8 text-primary" />
            LGPD — Lei Geral de Proteção de Dados
          </h1>
          <p className="text-base-content/70">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4 lg:px-8">
        <div className="prose prose-lg max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4 flex items-center gap-2">
              <ScrollText className="w-6 h-6 text-primary" />
              1. Nosso compromisso com a LGPD
            </h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              A <strong>Meta Consultoria</strong>, responsável pela plataforma <strong>ChekAI</strong>, trata dados
              pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018). Esta página
              resume como aplicamos a LGPD e como você pode exercer seus direitos como titular de dados.
            </p>
            <p className="text-base-content/80 leading-relaxed">
              Os detalhes completos sobre coleta, uso, compartilhamento e segurança estão descritos na nossa{' '}
              <Link href="/politica-privacidade" className="text-primary hover:underline font-medium">
                Política de Privacidade
              </Link>
              , que complementa este documento.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4 flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              2. Princípios que seguimos
            </h2>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2">
              <li><strong>Finalidade:</strong> tratamos dados para propósitos legítimos, específicos e informados</li>
              <li><strong>Adequação e necessidade:</strong> coletamos apenas o necessário para a finalidade</li>
              <li><strong>Transparência:</strong> informamos de forma clara como os dados são utilizados</li>
              <li><strong>Segurança:</strong> adotamos medidas técnicas e organizacionais para proteger os dados</li>
              <li><strong>Prevenção:</strong> buscamos evitar danos em razão do tratamento</li>
              <li><strong>Responsabilização:</strong> mantemos registros e práticas que comprovam a conformidade</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4 flex items-center gap-2">
              <Scale className="w-6 h-6 text-primary" />
              3. Bases legais para o tratamento
            </h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              O tratamento dos dados pessoais pode se apoiar em diferentes bases legais previstas na LGPD, conforme a
              situação:
            </p>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2">
              <li><strong>Execução de contrato:</strong> para fornecer e operar os serviços contratados</li>
              <li><strong>Consentimento:</strong> quando você autoriza expressamente determinada finalidade</li>
              <li><strong>Cumprimento de obrigação legal ou regulatória:</strong> quando exigido por lei</li>
              <li><strong>Legítimo interesse:</strong> para fins legítimos, respeitados seus direitos e liberdades</li>
              <li><strong>Exercício regular de direitos:</strong> inclusive em processos judiciais ou administrativos</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4 flex items-center gap-2">
              <UserCheck className="w-6 h-6 text-primary" />
              4. Seus direitos como titular
            </h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              A LGPD garante a você, como titular dos dados, os seguintes direitos:
            </p>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2">
              <li><strong>Confirmação e acesso:</strong> saber se tratamos seus dados e acessá-los</li>
              <li><strong>Correção:</strong> atualizar dados incompletos, inexatos ou desatualizados</li>
              <li><strong>Anonimização, bloqueio ou eliminação:</strong> de dados desnecessários ou excessivos</li>
              <li><strong>Portabilidade:</strong> a outro fornecedor de serviço ou produto</li>
              <li><strong>Eliminação:</strong> de dados tratados com base no seu consentimento</li>
              <li><strong>Informação sobre compartilhamento:</strong> com quais entidades compartilhamos dados</li>
              <li><strong>Revogação do consentimento:</strong> a qualquer momento, de forma facilitada</li>
              <li><strong>Oposição:</strong> ao tratamento realizado com base em hipótese diversa do consentimento</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4 flex items-center gap-2">
              <ListChecks className="w-6 h-6 text-primary" />
              5. Como exercer seus direitos
            </h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Para exercer qualquer um dos direitos acima, entre em contato pelos canais indicados abaixo. Podemos
              solicitar informações adicionais para confirmar sua identidade e atenderemos a solicitação nos prazos
              previstos na legislação aplicável.
            </p>
            <div className="bg-base-200 p-4 rounded-lg">
              <p className="text-base-content/80 mb-2"><strong>E-mail (Privacidade):</strong> privacidade@chekai.com.br</p>
              <p className="text-base-content/80 mb-2"><strong>Encarregado de Dados (DPO):</strong> dpo@chekai.com.br</p>
              <p className="text-base-content/80"><strong>Empresa:</strong> Meta Consultoria</p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4 flex items-center gap-2">
              <Mail className="w-6 h-6 text-primary" />
              6. Encarregado de Proteção de Dados (DPO)
            </h2>
            <p className="text-base-content/80 leading-relaxed">
              Designamos um Encarregado de Proteção de Dados (DPO) como canal de comunicação entre a empresa, os
              titulares e a Autoridade Nacional de Proteção de Dados (ANPD). Em caso de dúvidas ou solicitações
              relacionadas à proteção de dados, você pode contatá-lo pelo e-mail <strong>dpo@chekai.com.br</strong>.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">7. Documentos relacionados</h2>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2">
              <li>
                <Link href="/politica-privacidade" className="text-primary hover:underline font-medium">
                  Política de Privacidade
                </Link>
              </li>
              <li>
                <Link href="/politica-cookies" className="text-primary hover:underline font-medium">
                  Política de Cookies
                </Link>
              </li>
              <li>
                <Link href="/termos-uso" className="text-primary hover:underline font-medium">
                  Termos de Uso
                </Link>
              </li>
            </ul>
          </section>

          <div className="mt-12 pt-8 border-t border-base-300">
            <p className="text-sm text-base-content/60 text-center">
              Esta página está em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
