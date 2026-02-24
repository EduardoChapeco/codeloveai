import { Link } from "react-router-dom";
import { Scale, AlertTriangle } from "lucide-react";
import AppLayout from "@/components/AppLayout";

export default function TermsOfUse() {
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Scale className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Termos de Uso</h1>
            <p className="text-xs text-muted-foreground">Última atualização: 24 de Fevereiro de 2026</p>
          </div>
        </div>

        {/* LGPD notice */}
        <div className="mb-8 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-400 mb-1">Leia com atenção antes de usar</p>
            <p className="text-muted-foreground leading-relaxed">Ao usar o Starble, você concorda com estes termos. Se não concordar, não utilize a plataforma.</p>
          </div>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8 leading-relaxed">

          <section>
            <h2 className="text-lg font-bold mb-3">1. Aceitação dos Termos</h2>
            <p className="text-muted-foreground">O uso do Starble implica aceitação integral e irrestrita destes Termos de Uso. Estes termos podem ser atualizados periodicamente. Recomendamos revisar periodicamente. O uso continuado após mudanças constitui aceitação das novas condições.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">2. Descrição do Serviço</h2>
            <p className="text-muted-foreground">O Starble é uma plataforma de automação e inteligência que oferece:</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground mt-2">
              <li>Extensão Chrome para integração com ferramentas de criação de projetos</li>
              <li>Assistentes de IA para desenvolvimento de projetos digitais (Starble Brain)</li>
              <li>Motor autônomo de criação de projetos (Orchestrator Engine)</li>
              <li>Inteligência web por crawling (StarCrawl, powered by Firecrawl)</li>
              <li>Síntese de voz por IA (Voice AI, powered by ElevenLabs)</li>
              <li>Programa de afiliados e licenças White Label</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">3. Integrações com Terceiros e Limitações</h2>
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 mb-4">
              <p className="text-sm text-rose-300 font-semibold mb-2">⚠️ Risco Importante — Leia</p>
              <p className="text-sm text-muted-foreground">O Starble utiliza integrações com plataformas de terceiros. <strong>Mudanças nos termos, APIs ou políticas dessas plataformas estão fora do controle do Starble</strong> e podem afetar funcionalidades sem aviso prévio.</p>
            </div>
            <p className="text-muted-foreground">Ao usar o Starble, você reconhece e aceita que:</p>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground mt-2">
              <li>Funcionalidades dependentes de APIs de terceiros podem ser modificadas, limitadas ou descontinuadas sem aviso prévio</li>
              <li>O Starble não se responsabiliza por dados criados em plataformas de terceiros que possam ser perdidos por ações dessas plataformas</li>
              <li>Recomendamos fortemente manter backups independentes (GitHub para código, Supabase próprio para dados)</li>
              <li>Funcionalidades em fase "Lab" são experimentais e não possuem garantia de estabilidade ou continuidade</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">4. Responsabilidades do Usuário</h2>
            <p className="text-muted-foreground">O usuário é o único responsável por:</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground mt-2">
              <li>Manter backups de seu código e dados em sistemas de sua propriedade</li>
              <li>Conformidade com leis aplicáveis no uso das ferramentas</li>
              <li>Uso ético e legal das capacidades de IA (não usar para conteúdo ilegal, spam, fraude ou desinformação)</li>
              <li>Segurança de suas credenciais de acesso</li>
              <li>Propriedade intelectual do conteúdo gerado com as ferramentas</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">5. Planos e Pagamentos</h2>
            <p className="text-muted-foreground">O plano gratuito oferece 10 mensagens sem cartão de crédito. Planos pagos são processados via Stripe. Os preços podem mudar com aviso de 30 dias para usuários ativos.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">6. Política de Reembolso</h2>
            <p className="text-muted-foreground">Reembolsos podem ser solicitados em até <strong>7 dias</strong> após a cobrança, desde que o uso não ultrapasse 20% do plano contratado. Para solicitar, abra um ticket em <Link to="/suporte" className="text-primary hover:underline">/suporte</Link>.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">7. Privacidade e LGPD</h2>
            <p className="text-muted-foreground">O Starble é comprometido com a Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018). Coletamos apenas dados necessários para o funcionamento do serviço. Você tem direito de solicitar acesso, correção e exclusão dos seus dados a qualquer momento via <Link to="/suporte" className="text-primary hover:underline">/suporte</Link>.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">8. Programa de Afiliados</h2>
            <p className="text-muted-foreground">As regras específicas do programa estão detalhadas em <Link to="/afiliados" className="text-primary hover:underline">/afiliados</Link>. É terminantemente proibida a autoindicação e o uso de práticas fraudulentas. Violações resultam em cancelamento imediato da conta sem direito a reembolso de comissões acumuladas com práticas irregulares.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">9. White Label</h2>
            <p className="text-muted-foreground">Operadores White Label são responsáveis pelo suporte de primeiro nível de seus usuários e pela conformidade com a LGPD no que se refere aos dados coletados em seus tenants. O Starble presta suporte técnico apenas ao operador, não aos usuários finais do tenant.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">10. Limitação de Responsabilidade</h2>
            <p className="text-muted-foreground">O Starble não se responsabiliza por danos diretos, indiretos ou consequentes decorrentes do uso da plataforma, incluindo, mas não limitado a: perda de dados, lucros cessantes, ou danos de terceiros. Nossa responsabilidade máxima limita-se ao valor pago nos últimos 3 meses de assinatura.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">11. Suspensão e Encerramento</h2>
            <p className="text-muted-foreground">O Starble reserva-se o direito de suspender ou encerrar contas que violem estes termos, sem aviso prévio em casos de violação grave (fraude, uso ilegal, autoindicação).</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">12. Foro e Legislação</h2>
            <p className="text-muted-foreground">Estes termos são regidos pela lei brasileira. Fica eleito o foro da comarca de São Paulo - SP para resolver quaisquer disputas.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-3">13. Contato</h2>
            <p className="text-muted-foreground">Para questões legais, privacidade ou dúvidas sobre estes termos: abra um ticket em <Link to="/suporte" className="text-primary hover:underline">/suporte</Link> com a categoria "Jurídico/LGPD".</p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border/60 text-center">
          <p className="text-xs text-muted-foreground">© 2026 Starble. Todos os direitos reservados.</p>
          <div className="flex justify-center gap-6 mt-3 text-xs">
            <Link to="/ajuda" className="text-muted-foreground hover:text-foreground transition-colors">Central de Ajuda</Link>
            <Link to="/faq" className="text-muted-foreground hover:text-foreground transition-colors">FAQ</Link>
            <Link to="/suporte" className="text-muted-foreground hover:text-foreground transition-colors">Suporte</Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
