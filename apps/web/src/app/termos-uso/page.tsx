import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, FileText, AlertTriangle, Shield, CheckCircle, XCircle, Users } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Termos de Uso - ChekAI',
  description: 'Termos de Uso do ChekAI - Plataforma de auditoria em segurança de alimentos',
};

export default function TermosUsoPage() {
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
            <FileText className="w-8 h-8 text-primary" />
            Termos de Uso
          </h1>
          <p className="text-base-content/70">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4 lg:px-8">
        <div className="prose prose-lg max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4 flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-primary" />
              1. Aceitação dos Termos
            </h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Ao acessar e utilizar a plataforma <strong>ChekAI</strong>, operada pela <strong>Meta Consultoria</strong>, 
              você concorda em cumprir e estar vinculado a estes Termos de Uso. Se você não concorda com qualquer parte 
              destes termos, não deve utilizar nossa plataforma.
            </p>
            <p className="text-base-content/80 leading-relaxed">
              Estes termos constituem um acordo legal entre você e a Meta Consultoria. Recomendamos a leitura atenta 
              deste documento antes de utilizar nossos serviços.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4 flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              2. Definições
            </h2>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2">
              <li><strong>Plataforma:</strong> refere-se ao ChekAI, incluindo website, aplicativo e todos os serviços oferecidos</li>
              <li><strong>Usuário:</strong> pessoa física ou jurídica que utiliza a plataforma</li>
              <li><strong>Conta:</strong> registro criado pelo usuário para acessar os serviços</li>
              <li><strong>Serviços:</strong> todas as funcionalidades oferecidas pela plataforma, incluindo auditorias, análise de imagens, geração de relatórios, etc.</li>
              <li><strong>Conteúdo:</strong> qualquer informação, texto, imagem, dado ou material carregado ou gerado na plataforma</li>
              <li><strong>IA:</strong> inteligência artificial utilizada para análise de imagens e geração de conteúdo</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">3. Cadastro e Conta do Usuário</h2>
            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">3.1. Requisitos para Cadastro</h3>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2 mb-4">
              <li>Você deve ter pelo menos 18 anos de idade ou representar uma pessoa jurídica</li>
              <li>Você deve fornecer informações precisas, completas e atualizadas</li>
              <li>Você é responsável por manter a confidencialidade de suas credenciais de acesso</li>
              <li>Você é responsável por todas as atividades que ocorrem em sua conta</li>
            </ul>

            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">3.2. Segurança da Conta</h3>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Você é responsável por:
            </p>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2">
              <li>Manter a segurança de sua senha e informações de conta</li>
              <li>Notificar-nos imediatamente sobre qualquer uso não autorizado de sua conta</li>
              <li>Garantir que todas as informações fornecidas sejam verdadeiras e atualizadas</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">4. Uso da Plataforma</h2>
            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">4.1. Uso Permitido</h3>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Você pode utilizar a plataforma para:
            </p>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2 mb-4">
              <li>Realizar auditorias em segurança de alimentos</li>
              <li>Gerenciar clientes e unidades auditadas</li>
              <li>Gerar relatórios técnicos e planos de ação</li>
              <li>Acessar base de legislação e templates de checklist</li>
              <li>Utilizar ferramentas de análise de imagens com IA</li>
            </ul>

            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              4.2. Uso Proibido
            </h3>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Você <strong>NÃO</strong> pode:
            </p>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2">
              <li>Utilizar a plataforma para atividades ilegais ou não autorizadas</li>
              <li>Violar direitos de propriedade intelectual ou outros direitos de terceiros</li>
              <li>Transmitir vírus, malware ou código malicioso</li>
              <li>Tentar acessar áreas restritas da plataforma sem autorização</li>
              <li>Interferir ou interromper o funcionamento da plataforma</li>
              <li>Realizar engenharia reversa, descompilar ou desmontar qualquer parte da plataforma</li>
              <li>Utilizar bots, scripts automatizados ou outros meios para acessar a plataforma de forma não autorizada</li>
              <li>Compartilhar sua conta com terceiros</li>
              <li>Utilizar a plataforma de forma que possa danificar, desabilitar ou sobrecarregar nossos servidores</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">5. Conteúdo do Usuário</h2>
            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">5.1. Propriedade do Conteúdo</h3>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Você mantém todos os direitos sobre o conteúdo que você carrega ou cria na plataforma (dados de auditorias, 
              imagens, textos, etc.). Ao utilizar nossos serviços, você nos concede uma licença não exclusiva, mundial e 
              livre de royalties para usar, processar e armazenar seu conteúdo apenas para fornecer e melhorar nossos serviços.
            </p>

            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">5.2. Responsabilidade pelo Conteúdo</h3>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Você é responsável por:
            </p>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2">
              <li>Garantir que possui todos os direitos necessários sobre o conteúdo que carrega</li>
              <li>Garantir que o conteúdo não viola direitos de terceiros</li>
              <li>Garantir a precisão e veracidade das informações fornecidas</li>
              <li>Manter backups adequados de seus dados</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">6. Inteligência Artificial</h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Nossa plataforma utiliza inteligência artificial para análise de imagens e geração de conteúdo. 
              Você entende e concorda que:
            </p>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2">
              <li>Os resultados gerados pela IA são sugestões e devem ser revisados e validados pelo usuário</li>
              <li>A IA pode não identificar todas as não conformidades ou pode gerar falsos positivos</li>
              <li>Você é responsável pela validação final de todos os relatórios e análises gerados</li>
              <li>A precisão da IA pode variar dependendo da qualidade das imagens e outros fatores</li>
              <li>Não garantimos 100% de precisão nas análises realizadas pela IA</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">7. Planos e Pagamentos</h2>
            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">7.1. Planos de Assinatura</h3>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Oferecemos diferentes planos de assinatura com funcionalidades e limites variados. Os preços, 
              funcionalidades e limites podem ser alterados a qualquer momento, com aviso prévio.
            </p>

            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">7.2. Pagamentos</h3>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2 mb-4">
              <li>Os pagamentos são processados por provedores terceirizados seguros</li>
              <li>As assinaturas são renovadas automaticamente, a menos que canceladas</li>
              <li>Você pode cancelar sua assinatura a qualquer momento</li>
              <li>Reembolsos são tratados conforme nossa política de reembolso</li>
            </ul>

            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">7.3. Créditos</h3>
            <p className="text-base-content/80 leading-relaxed">
              Algumas funcionalidades podem consumir créditos. Créditos adquiridos têm validade conforme 
              especificado no momento da compra. Créditos não utilizados podem expirar.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4 flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              8. Limitação de Responsabilidade
            </h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              A plataforma é fornecida &quot;como está&quot; e &quot;conforme disponível&quot;. Não garantimos que:
            </p>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2 mb-4">
              <li>A plataforma estará sempre disponível ou livre de erros</li>
              <li>Os resultados da IA serão 100% precisos</li>
              <li>A plataforma atenderá todas as suas necessidades específicas</li>
              <li>Os dados estarão sempre seguros contra todos os tipos de ameaças</li>
            </ul>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Em nenhuma circunstância seremos responsáveis por:
            </p>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2">
              <li>Danos diretos, indiretos, incidentais ou consequenciais</li>
              <li>Perda de dados, lucros ou oportunidades de negócio</li>
              <li>Decisões tomadas com base em análises ou relatórios gerados pela plataforma</li>
              <li>Não conformidades não identificadas pela IA ou pela plataforma</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">9. Propriedade Intelectual</h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Todos os direitos de propriedade intelectual relacionados à plataforma, incluindo mas não limitado a 
              software, design, textos, gráficos, logos, ícones e funcionalidades, são de propriedade da Meta Consultoria 
              ou de seus licenciadores.
            </p>
            <p className="text-base-content/80 leading-relaxed">
              Você não pode copiar, modificar, distribuir, vender ou alugar qualquer parte da plataforma sem nossa 
              autorização prévia por escrito.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">10. Privacidade</h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              O tratamento de seus dados pessoais é regido por nossa{' '}
              <Link href="/politica-privacidade" className="text-primary hover:underline font-medium">
                Política de Privacidade
              </Link>
              , que faz parte integrante destes Termos de Uso.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4 flex items-center gap-2">
              <XCircle className="w-6 h-6 text-error" />
              11. Rescisão
            </h2>
            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">11.1. Rescisão pelo Usuário</h3>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Você pode encerrar sua conta a qualquer momento através das configurações da plataforma ou entrando 
              em contato conosco.
            </p>

            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">11.2. Rescisão pela Meta Consultoria</h3>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Podemos suspender ou encerrar sua conta imediatamente se você:
            </p>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2 mb-4">
              <li>Violar estes Termos de Uso</li>
              <li>Utilizar a plataforma de forma fraudulenta ou ilegal</li>
              <li>Não efetuar pagamentos devidos</li>
              <li>Realizar atividades que possam prejudicar a plataforma ou outros usuários</li>
            </ul>

            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">11.3. Efeitos da Rescisão</h3>
            <p className="text-base-content/80 leading-relaxed">
              Após a rescisão, você perderá o acesso à sua conta e aos dados associados, exceto quando a retenção 
              for exigida por lei. Recomendamos fazer backup de seus dados antes de encerrar a conta.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">12. Modificações dos Termos</h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Reservamo-nos o direito de modificar estes Termos de Uso a qualquer momento. Alterações significativas 
              serão comunicadas através de e-mail ou aviso na plataforma.
            </p>
            <p className="text-base-content/80 leading-relaxed">
              O uso continuado da plataforma após as modificações constitui sua aceitação dos novos termos. 
              Se você não concordar com as alterações, deve encerrar sua conta.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">13. Lei Aplicável e Foro</h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Estes Termos de Uso são regidos pelas leis brasileiras. Qualquer disputa relacionada a estes termos 
              será resolvida no foro da comarca de [Cidade], Estado de [Estado], com exclusão de qualquer outro, 
              por mais privilegiado que seja.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">14. Disposições Gerais</h2>
            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">14.1. Acordo Completo</h3>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Estes Termos de Uso, juntamente com nossa Política de Privacidade, constituem o acordo completo entre 
              você e a Meta Consultoria em relação ao uso da plataforma.
            </p>

            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">14.2. Renúncia</h3>
            <p className="text-base-content/80 leading-relaxed mb-4">
              O fato de não exercermos qualquer direito previsto nestes termos não constitui renúncia a tal direito.
            </p>

            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">14.3. Divisibilidade</h3>
            <p className="text-base-content/80 leading-relaxed">
              Se qualquer disposição destes termos for considerada inválida ou inexequível, as demais disposições 
              permanecerão em pleno vigor.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">15. Contato</h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Para questões relacionadas a estes Termos de Uso, entre em contato conosco:
            </p>
            <div className="bg-base-200 p-4 rounded-lg">
              <p className="text-base-content/80 mb-2"><strong>E-mail:</strong> suporte@chekai.com.br</p>
              <p className="text-base-content/80 mb-2"><strong>Legal:</strong> legal@chekai.com.br</p>
              <p className="text-base-content/80"><strong>Empresa:</strong> Meta Consultoria</p>
            </div>
          </section>

          <div className="mt-12 pt-8 border-t border-base-300">
            <p className="text-sm text-base-content/60 text-center">
              Ao utilizar a plataforma ChekAI, você confirma que leu, compreendeu e concorda com estes Termos de Uso.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
