import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Shield, Lock, Eye, FileText, Users, Database } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Política de Privacidade - ChekAI',
  description: 'Política de Privacidade do ChekAI - Plataforma de auditoria em segurança de alimentos',
};

export default function PoliticaPrivacidadePage() {
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
            <Shield className="w-8 h-8 text-primary" />
            Política de Privacidade
          </h1>
          <p className="text-base-content/70">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4 lg:px-8">
        <div className="prose prose-lg max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4 flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              1. Introdução
            </h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              A <strong>Meta Consultoria</strong>, empresa responsável pela plataforma <strong>ChekAI</strong>, 
              está comprometida com a proteção da privacidade e dos dados pessoais de seus usuários. Esta 
              Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos suas informações 
              pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
            </p>
            <p className="text-base-content/80 leading-relaxed">
              Ao utilizar nossa plataforma, você concorda com as práticas descritas nesta política. 
              Recomendamos a leitura atenta deste documento.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4 flex items-center gap-2">
              <Database className="w-6 h-6 text-primary" />
              2. Dados Coletados
            </h2>
            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">2.1. Dados Fornecidos pelo Usuário</h3>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2 mb-4">
              <li><strong>Dados de cadastro:</strong> nome completo, e-mail, telefone, CPF/CNPJ, endereço</li>
              <li><strong>Dados profissionais:</strong> área de atuação, experiência, certificações</li>
              <li><strong>Dados de clientes:</strong> informações sobre empresas e unidades auditadas</li>
              <li><strong>Dados de auditorias:</strong> checklists preenchidos, fotografias, observações, localização geográfica</li>
              <li><strong>Dados de pagamento:</strong> informações de cartão de crédito (processadas por provedores terceirizados seguros)</li>
            </ul>

            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">2.2. Dados Coletados Automaticamente</h3>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2">
              <li><strong>Dados de uso:</strong> páginas visitadas, tempo de permanência, ações realizadas na plataforma</li>
              <li><strong>Dados técnicos:</strong> endereço IP, tipo de navegador, sistema operacional, dispositivo utilizado</li>
              <li><strong>Dados de localização:</strong> coordenadas GPS quando você realiza auditorias (com sua permissão)</li>
              <li><strong>Cookies e tecnologias similares:</strong> para melhorar sua experiência e analisar o uso da plataforma</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4 flex items-center gap-2">
              <Eye className="w-6 h-6 text-primary" />
              3. Finalidade do Uso dos Dados
            </h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Utilizamos seus dados pessoais para as seguintes finalidades:
            </p>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2">
              <li>Fornecer e melhorar nossos serviços de auditoria e consultoria</li>
              <li>Processar e gerenciar suas auditorias e relatórios</li>
              <li>Analisar imagens através de inteligência artificial para identificar não conformidades</li>
              <li>Gerar relatórios técnicos e planos de ação personalizados</li>
              <li>Gerenciar sua conta e processar pagamentos</li>
              <li>Enviar comunicações importantes sobre o serviço</li>
              <li>Personalizar sua experiência na plataforma</li>
              <li>Realizar análises estatísticas e melhorias nos serviços</li>
              <li>Cumprir obrigações legais e regulatórias</li>
              <li>Prevenir fraudes e garantir a segurança da plataforma</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4 flex items-center gap-2">
              <Lock className="w-6 h-6 text-primary" />
              4. Compartilhamento de Dados
            </h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Não vendemos seus dados pessoais. Podemos compartilhar suas informações apenas nas seguintes situações:
            </p>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2">
              <li><strong>Prestadores de serviços:</strong> empresas que nos auxiliam na operação da plataforma (hospedagem, processamento de pagamentos, análise de dados)</li>
              <li><strong>Provedores de IA:</strong> para processamento de imagens e análise de conteúdo (com garantias de segurança e privacidade)</li>
              <li><strong>Obrigações legais:</strong> quando exigido por lei, ordem judicial ou autoridades competentes</li>
              <li><strong>Proteção de direitos:</strong> para proteger nossos direitos, propriedade ou segurança, ou de nossos usuários</li>
              <li><strong>Com seu consentimento:</strong> em outras situações, quando você autorizar expressamente</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">5. Segurança dos Dados</h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Implementamos medidas técnicas e organizacionais adequadas para proteger seus dados pessoais contra 
              acesso não autorizado, alteração, divulgação ou destruição:
            </p>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2">
              <li>Criptografia de dados em trânsito e em repouso</li>
              <li>Controle de acesso baseado em permissões</li>
              <li>Monitoramento contínuo de segurança</li>
              <li>Backups regulares e planos de recuperação de desastres</li>
              <li>Treinamento regular de nossa equipe sobre segurança de dados</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">6. Retenção de Dados</h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Mantemos seus dados pessoais pelo tempo necessário para cumprir as finalidades descritas nesta política, 
              exceto quando a retenção for exigida ou permitida por lei. Dados de auditorias são mantidos conforme 
              exigências legais e regulatórias do setor de segurança de alimentos.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">7. Seus Direitos (LGPD)</h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              De acordo com a LGPD, você tem os seguintes direitos:
            </p>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2">
              <li><strong>Confirmação e acesso:</strong> saber se tratamos seus dados e acessá-los</li>
              <li><strong>Correção:</strong> solicitar a correção de dados incompletos, inexatos ou desatualizados</li>
              <li><strong>Anonimização, bloqueio ou eliminação:</strong> solicitar a remoção de dados desnecessários ou excessivos</li>
              <li><strong>Portabilidade:</strong> solicitar a portabilidade de seus dados para outro fornecedor</li>
              <li><strong>Eliminação:</strong> solicitar a eliminação de dados tratados com seu consentimento</li>
              <li><strong>Revogação do consentimento:</strong> revogar seu consentimento a qualquer momento</li>
              <li><strong>Informação:</strong> obter informações sobre entidades públicas e privadas com as quais compartilhamos dados</li>
            </ul>
            <p className="text-base-content/80 leading-relaxed mt-4">
              Para exercer seus direitos, entre em contato conosco através do e-mail: <strong>privacidade@chekai.com.br</strong>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">8. Cookies e Tecnologias Similares</h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Utilizamos cookies e tecnologias similares para melhorar sua experiência, analisar o uso da plataforma 
              e personalizar conteúdo. Você pode gerenciar suas preferências de cookies através das configurações 
              do seu navegador.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">9. Dados de Menores de Idade</h2>
            <p className="text-base-content/80 leading-relaxed">
              Nossa plataforma não é destinada a menores de 18 anos. Não coletamos intencionalmente dados pessoais 
              de menores. Se tomarmos conhecimento de que coletamos dados de um menor, tomaremos medidas para 
              excluir essas informações.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">10. Alterações nesta Política</h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos você sobre alterações 
              significativas através de e-mail ou aviso na plataforma. A data da última atualização está indicada 
              no início deste documento.
            </p>
            <p className="text-base-content/80 leading-relaxed">
              Recomendamos que você revise esta política regularmente para se manter informado sobre como protegemos 
              seus dados.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">11. Encarregado de Proteção de Dados (DPO)</h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Para questões relacionadas à proteção de dados pessoais, você pode entrar em contato com nosso 
              Encarregado de Proteção de Dados:
            </p>
            <div className="bg-base-200 p-4 rounded-lg">
              <p className="text-base-content/80 mb-2"><strong>E-mail:</strong> dpo@chekai.com.br</p>
              <p className="text-base-content/80"><strong>Empresa:</strong> Meta Consultoria</p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">12. Contato</h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Se você tiver dúvidas, preocupações ou solicitações relacionadas a esta Política de Privacidade 
              ou ao tratamento de seus dados pessoais, entre em contato conosco:
            </p>
            <div className="bg-base-200 p-4 rounded-lg">
              <p className="text-base-content/80 mb-2"><strong>E-mail:</strong> privacidade@chekai.com.br</p>
              <p className="text-base-content/80 mb-2"><strong>Suporte:</strong> suporte@chekai.com.br</p>
              <p className="text-base-content/80"><strong>Empresa:</strong> Meta Consultoria</p>
            </div>
          </section>

          <div className="mt-12 pt-8 border-t border-base-300">
            <p className="text-sm text-base-content/60 text-center">
              Esta política está em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
