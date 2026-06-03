import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Cookie, Settings, BarChart3, ShieldCheck, ToggleRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Política de Cookies - ChekAI',
  description:
    'Política de Cookies do ChekAI — o que são cookies, como utilizamos e como gerenciar suas preferências.',
};

export default function PoliticaCookiesPage() {
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
            <Cookie className="w-8 h-8 text-primary" />
            Política de Cookies
          </h1>
          <p className="text-base-content/70">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4 lg:px-8">
        <div className="prose prose-lg max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4 flex items-center gap-2">
              <Cookie className="w-6 h-6 text-primary" />
              1. O que são cookies
            </h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Cookies são pequenos arquivos de texto armazenados no seu dispositivo (computador, tablet ou celular)
              quando você acessa um site. Eles permitem que a plataforma reconheça seu navegador, lembre preferências
              e entenda como o site é utilizado. Além de cookies, podemos usar tecnologias similares, como
              armazenamento local do navegador e identificadores anônimos.
            </p>
            <p className="text-base-content/80 leading-relaxed">
              Esta Política de Cookies explica como a <strong>Meta Consultoria</strong>, responsável pela plataforma
              <strong> ChekAI</strong>, utiliza esses recursos e como você pode gerenciá-los.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4 flex items-center gap-2">
              <Settings className="w-6 h-6 text-primary" />
              2. Como utilizamos cookies
            </h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Utilizamos cookies para garantir o funcionamento da plataforma, lembrar suas escolhas, manter sua sessão
              autenticada com segurança e entender como melhorar a experiência de uso.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-primary" />
              3. Tipos de cookies que usamos
            </h2>

            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">3.1. Cookies essenciais</h3>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Necessários para o funcionamento da plataforma. Permitem ações básicas como navegação, autenticação,
              manutenção da sessão e segurança. Sem eles, partes do serviço não funcionam corretamente. Por serem
              indispensáveis, não dependem de consentimento prévio.
            </p>

            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">3.2. Cookies de preferências</h3>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Armazenam suas escolhas, como o registro do consentimento de cookies, para que não seja necessário
              configurá-las a cada visita.
            </p>

            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">3.3. Cookies de desempenho e análise</h3>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Ajudam a entender como os visitantes utilizam a plataforma — páginas mais acessadas, tempo de permanência
              e eventuais erros —, de forma agregada, para aprimorar continuamente o serviço.
            </p>

            <h3 className="text-xl font-semibold text-base-content mb-3 mt-4">3.4. Cookies de terceiros</h3>
            <p className="text-base-content/80 leading-relaxed">
              Alguns recursos podem depender de serviços de terceiros (por exemplo, incorporação de vídeos, provedores
              de infraestrutura ou análise). Esses parceiros podem definir seus próprios cookies, sujeitos às respectivas
              políticas de privacidade.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4 flex items-center gap-2">
              <ToggleRight className="w-6 h-6 text-primary" />
              4. Gerenciamento de cookies
            </h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Ao acessar a plataforma pela primeira vez, exibimos um aviso de consentimento no qual você pode aceitar ou
              recusar cookies não essenciais. Sua escolha fica registrada e pode ser alterada limpando os dados do
              navegador para que o aviso seja exibido novamente.
            </p>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Você também pode gerenciar ou remover cookies diretamente pelas configurações do seu navegador. Veja como
              nos navegadores mais comuns:
            </p>
            <ul className="list-disc pl-6 text-base-content/80 space-y-2">
              <li>Google Chrome: Configurações → Privacidade e segurança → Cookies e outros dados do site</li>
              <li>Mozilla Firefox: Configurações → Privacidade e Segurança → Cookies e dados de sites</li>
              <li>Safari: Preferências → Privacidade → Gerenciar dados do site</li>
              <li>Microsoft Edge: Configurações → Cookies e permissões de site</li>
            </ul>
            <p className="text-base-content/80 leading-relaxed mt-4">
              O bloqueio de cookies essenciais pode comprometer o funcionamento de partes da plataforma.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" />
              5. Consentimento e LGPD
            </h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              O uso de cookies não essenciais ocorre mediante o seu consentimento, que pode ser revogado a qualquer
              momento, em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018). O tratamento dos
              dados eventualmente coletados por cookies segue nossa{' '}
              <Link href="/politica-privacidade" className="text-primary hover:underline font-medium">
                Política de Privacidade
              </Link>
              . Para mais informações sobre seus direitos, consulte também a página{' '}
              <Link href="/lgpd" className="text-primary hover:underline font-medium">
                LGPD
              </Link>
              .
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">6. Alterações nesta política</h2>
            <p className="text-base-content/80 leading-relaxed">
              Podemos atualizar esta Política de Cookies periodicamente para refletir mudanças nas tecnologias utilizadas
              ou na legislação aplicável. A data da última atualização está indicada no início deste documento.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-base-content mb-4">7. Contato</h2>
            <p className="text-base-content/80 leading-relaxed mb-4">
              Em caso de dúvidas sobre esta Política de Cookies, entre em contato conosco:
            </p>
            <div className="bg-base-200 p-4 rounded-lg">
              <p className="text-base-content/80 mb-2"><strong>E-mail:</strong> privacidade@chekai.com.br</p>
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
