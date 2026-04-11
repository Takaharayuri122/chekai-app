import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, FileText, AlertTriangle, Shield, CheckCircle, XCircle, Users } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Termos de Uso - ChekAI',
  description:
    'Termos de Uso do ChekAI — plataforma web e aplicativos para auditorias, checklists com IA, relatórios e gestão em segurança de alimentos.',
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
              <li>
                <strong>Plataforma:</strong> o ecossistema ChekAI, incluindo site, painel web, aplicativos móveis
                oficiais e integrações disponibilizadas pela Meta Consultoria.
              </li>
              <li>
                <strong>Usuário:</strong> pessoa física ou jurídica que utiliza a plataforma, diretamente ou por meio de
                convite.
              </li>
              <li>
                <strong>Conta:</strong> credenciais e perfil vinculados ao acesso aos serviços.
              </li>
              <li>
                <strong>Serviços:</strong> funcionalidades oferecidas, tais como templates e checklists, auditorias,
                relatórios técnicos, legislação e apoio por IA, análise de imagens, gestão de clientes e equipe,
                check-in e geolocalização quando habilitados, exportações, créditos de uso de IA e demais módulos
                disponíveis no plano contratado.
              </li>
              <li>
                <strong>Conteúdo:</strong> informações, textos, imagens, geodados, registros de visita e demais dados
                inseridos ou gerados pelo usuário ou em seu nome.
              </li>
              <li>
                <strong>IA:</strong> recursos de inteligência artificial de terceiros ou próprios usados para sugerir
                textos, itens, análises ou apoio à decisão, conforme o módulo utilizado.
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">3. Natureza dos serviços, aplicativos e lojas</h2>
            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">3.1. Canais de acesso</h3>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Os Serviços podem ser acessados por navegador e por aplicativos móveis distribuídos nas lojas oficiais
              (por exemplo, Apple App Store e Google Play), quando disponíveis. Recursos podem variar conforme versão,
              dispositivo e plano.
            </p>
            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">3.2. Termos das lojas e de pagamento</h3>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Ao instalar ou usar o aplicativo obtido em loja de terceiros, você também fica sujeito aos termos, regras e
              políticas aplicáveis àquela loja e ao meio de pagamento utilizado (incluindo assinaturas gerenciadas pela
              loja, quando for o caso). Em caso de conflito sobre um tema já disciplinado pela Apple ou Google, prevalece
              o que for exigido pela legislação aplicável e pelas regras da respectiva loja naquela matéria.
            </p>
            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">3.3. Perfis, convites e organização</h3>
            <p className="text-base-content/80 leading-relaxed mb-4">
              O acesso pode ocorrer por convite, com perfis distintos (como administrativo, gestor e auditor), conforme
              configurado para a sua organização. O responsável pela conta corporativa ou pelo convite deve garantir que
              apenas pessoas autorizadas utilizem credenciais e que o uso esteja alinhado a estes Termos e às obrigações
              legais da consultoria ou empresa.
            </p>
            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">3.4. Auditorias e relatórios técnicos</h3>
            <p className="text-base-content/80 leading-relaxed mb-4">
              A Plataforma pode oferecer fluxos distintos, como auditorias com checklist e pontuação e, separadamente,
              relatórios técnicos por cliente. A ferramenta tem natureza de apoio profissional: não substitui parecer,
              responsabilidade técnica, obrigações contratuais com seus clientes nem exigências legais ou regulatórias
              aplicáveis ao seu trabalho. O usuário permanece responsável pelas conclusões entregues a terceiros e pelo
              cumprimento das normas da sua área.
            </p>
            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">3.5. Geolocalização e check-in</h3>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Quando você utilizar recursos de registro de presença, visita ou localização, estes dependerão de
              permissões do dispositivo e serão tratados conforme descrito na{' '}
              <Link href="/politica-privacidade" className="text-primary hover:underline font-medium">
                Política de Privacidade
              </Link>
              , para fins operacionais como rastreabilidade e registro de atividade em campo.
            </p>
            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">3.6. Disponibilidade e alterações</h3>
            <p className="text-base-content/80 leading-relaxed">
              Empregamos esforços razoáveis para manter os Serviços disponíveis, porém podem ocorrer interrupções por
              manutenção, atualização, caso fortuito, força maior ou falhas de terceiros (incluindo provedores de nuvem e
              de IA). Funcionalidades podem ser alteradas, descontinuadas ou substituídas com o tempo, mediante aviso
              quando apropriado.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">4. Cadastro e Conta do Usuário</h2>
            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">4.1. Requisitos para Cadastro</h3>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2 mb-4">
              <li>Você deve ter pelo menos 18 anos de idade ou representar uma pessoa jurídica</li>
              <li>Você deve fornecer informações precisas, completas e atualizadas</li>
              <li>Você é responsável por manter a confidencialidade de suas credenciais de acesso</li>
              <li>Você é responsável por todas as atividades que ocorrem em sua conta</li>
            </ul>

            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">4.2. Segurança da Conta</h3>
            <p className="text-base-content/80 leading-relaxed mb-4">Você é responsável por:</p>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2">
              <li>Manter a segurança de sua senha e informações de conta</li>
              <li>Notificar-nos imediatamente sobre qualquer uso não autorizado de sua conta</li>
              <li>Garantir que todas as informações fornecidas sejam verdadeiras e atualizadas</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">5. Uso da Plataforma</h2>
            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">5.1. Uso Permitido</h3>
            <p className="text-base-content/80 leading-relaxed mb-4">Você pode utilizar a plataforma para:</p>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2 mb-4">
              <li>Elaborar e gerir templates de checklist e materiais de auditoria em segurança de alimentos</li>
              <li>Realizar auditorias e registrar evidências, inclusive com apoio de IA quando disponível</li>
              <li>Gerenciar clientes, unidades e equipe conforme seu perfil e permissões</li>
              <li>Produzir relatórios e exportações permitidas pelo seu plano, incluindo relatórios técnicos quando aplicável</li>
              <li>Consultar legislação e bases de conhecimento disponibilizadas na Plataforma</li>
              <li>Utilizar aplicativo móvel e recursos de localização ou check-in quando oferecidos e autorizados</li>
            </ul>

            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              5.2. Uso Proibido
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
              <li>Realizar engenharia reversa, descompilar ou desmontar qualquer parte da plataforma, exceto quando a lei permitir</li>
              <li>Utilizar bots, scripts automatizados ou outros meios para acessar a plataforma de forma não autorizada</li>
              <li>Compartilhar sua conta com terceiros não autorizados</li>
              <li>Utilizar a plataforma de forma que possa danificar, desabilitar ou sobrecarregar nossos servidores</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">6. Conteúdo do Usuário</h2>
            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">6.1. Propriedade do Conteúdo</h3>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Você mantém os direitos sobre o conteúdo que você carrega ou cria na plataforma (dados de auditorias,
              imagens, textos, etc.). Ao utilizar nossos serviços, você nos concede uma licença não exclusiva, mundial e
              livre de royalties para usar, processar e armazenar seu conteúdo apenas para fornecer e melhorar nossos serviços.
            </p>

            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">6.2. Responsabilidade pelo Conteúdo</h3>
            <p className="text-base-content/80 leading-relaxed mb-4">Você é responsável por:</p>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2">
              <li>Garantir que possui todos os direitos necessários sobre o conteúdo que carrega</li>
              <li>Garantir que o conteúdo não viola direitos de terceiros</li>
              <li>Garantir a precisão e veracidade das informações fornecidas</li>
              <li>Manter backups adequados de seus dados</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">7. Inteligência Artificial e créditos</h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              A Plataforma pode utilizar inteligência artificial para sugestões em textos e itens, apoio à análise de
              imagens e outros recursos. Você entende e concorda que:
            </p>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2 mb-4">
              <li>Os resultados gerados pela IA são assistivos e devem ser revisados e validados por pessoas habilitadas</li>
              <li>A IA pode não identificar todas as não conformidades ou pode gerar sugestões incorretas ou incompletas</li>
              <li>Você é responsável pela validação final de relatórios, pareceres e entregas aos seus clientes</li>
              <li>A qualidade da saída pode depender de insumos (texto, imagens, configurações) e de limitações dos modelos</li>
              <li>Provedores de IA, modelos e integrações podem ser atualizados ou substituídos sem aviso prévio individual</li>
              <li>O uso de recursos de IA pode consumir créditos ou limites associados ao seu plano; a disponibilidade de créditos não garante resultado específico</li>
            </ul>
            <p className="text-base-content/80 leading-relaxed">
              O consumo de créditos ou tokens, bem como regras de distribuição entre usuários da mesma organização, segue
              as configurações da conta e do contrato ou plano vigente.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">8. Planos e Pagamentos</h2>
            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">8.1. Planos de Assinatura</h3>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Oferecemos diferentes planos de assinatura com funcionalidades e limites variados. Os preços,
              funcionalidades e limites podem ser alterados mediante aviso prévio, nos termos do contrato ou da própria
              plataforma ou loja de aplicativos, quando aplicável.
            </p>

            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">8.2. Pagamentos</h3>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2 mb-4">
              <li>Os pagamentos podem ser processados por provedores terceirizados ou pelas lojas de aplicativos</li>
              <li>As assinaturas podem ser renovadas automaticamente, conforme a modalidade contratada, a menos que canceladas</li>
              <li>Você pode cancelar sua assinatura conforme as regras do canal de compra (web ou loja)</li>
              <li>Reembolsos são tratados conforme a política aplicável ao meio de pagamento e à legislação consumerista</li>
            </ul>

            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">8.3. Créditos</h3>
            <p className="text-base-content/80 leading-relaxed">
              Algumas funcionalidades podem consumir créditos ou cotas de IA. Créditos adquiridos ou atribuídos têm
              validade e regras conforme especificado no momento da compra ou no painel da conta. Créditos não utilizados
              podem expirar. A gestão interna de créditos entre membros da equipe obedece às permissões do gestor
              responsável.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4 flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              9. Limitação de Responsabilidade
            </h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              A plataforma é fornecida &quot;como está&quot; e &quot;conforme disponível&quot;. Não garantimos que:
            </p>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2 mb-4">
              <li>A plataforma estará sempre disponível ou livre de erros</li>
              <li>Os resultados da IA atenderão integralmente às suas expectativas ou a requisitos regulatórios específicos</li>
              <li>A plataforma atenderá todas as suas necessidades específicas</li>
              <li>Os dados estarão sempre seguros contra todos os tipos de ameaças</li>
            </ul>
            <p className="text-base-content/80 leading-relaxed mb-4">Em nenhuma circunstância seremos responsáveis por:</p>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2">
              <li>Danos diretos, indiretos, incidentais ou consequenciais</li>
              <li>Perda de dados, lucros ou oportunidades de negócio</li>
              <li>Decisões tomadas com base em análises, sugestões ou relatórios gerados pela plataforma</li>
              <li>Não conformidades não identificadas pela IA ou pela plataforma</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">10. Propriedade Intelectual</h2>
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
            <h2 className="text-2xl font-semibold text-base-content mb-4">11. Privacidade</h2>
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
              12. Rescisão
            </h2>
            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">12.1. Rescisão pelo Usuário</h3>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Você pode encerrar sua conta a qualquer momento através das configurações da plataforma ou entrando em
              contato conosco.
            </p>

            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">12.2. Rescisão pela Meta Consultoria</h3>
            <p className="text-base-content/80 leading-relaxed mb-4">Podemos suspender ou encerrar sua conta imediatamente se você:</p>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2 mb-4">
              <li>Violar estes Termos de Uso</li>
              <li>Utilizar a plataforma de forma fraudulenta ou ilegal</li>
              <li>Não efetuar pagamentos devidos</li>
              <li>Realizar atividades que possam prejudicar a plataforma ou outros usuários</li>
            </ul>

            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">12.3. Efeitos da Rescisão</h3>
            <p className="text-base-content/80 leading-relaxed">
              Após a rescisão, você perderá o acesso à sua conta e aos dados associados, exceto quando a retenção for
              exigida por lei. Recomendamos fazer backup de seus dados antes de encerrar a conta.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">13. Modificações dos Termos</h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Reservamo-nos o direito de modificar estes Termos de Uso a qualquer momento. Alterações significativas serão
              comunicadas através de e-mail ou aviso na plataforma ou no aplicativo.
            </p>
            <p className="text-base-content/80 leading-relaxed">
              O uso continuado da plataforma após as modificações constitui sua aceitação dos novos termos. Se você não
              concordar com as alterações, deve encerrar sua conta.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">14. Lei aplicável e resolução de conflitos</h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil, sem considerar conflitos de
              leis. As partes elegem o foro dos tribunais brasileiros competentes para dirimir controvérsias decorrentes
              destes Termos, observada a legislação consumerista e demais normas imperativas aplicáveis, inclusive em
              relação a compras realizadas por meio de lojas de aplicativos internacionais quando a lei assim exigir.
            </p>
            <p className="text-base-content/80 leading-relaxed">
              Quando permitido pela legislação aplicável à relação concreta, você concorda em tentar resolver
              previamente qualquer reclamação de boa-fé entrando em contato pelos canais indicados na seção de Contato.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">15. Disposições Gerais</h2>
            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">15.1. Acordo Completo</h3>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Estes Termos de Uso, juntamente com nossa Política de Privacidade, constituem o acordo completo entre você e
              a Meta Consultoria em relação ao uso da plataforma.
            </p>

            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">15.2. Renúncia</h3>
            <p className="text-base-content/80 leading-relaxed mb-4">
              O fato de não exercermos qualquer direito previsto nestes termos não constitui renúncia a tal direito.
            </p>

            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">15.3. Divisibilidade</h3>
            <p className="text-base-content/80 leading-relaxed">
              Se qualquer disposição destes termos for considerada inválida ou inexequível, as demais disposições
              permanecerão em pleno vigor.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">16. Contato</h2>
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
