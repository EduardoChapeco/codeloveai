import { Link } from "react-router-dom";
import { Scale, AlertTriangle } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useSEO } from "@/hooks/useSEO";

export default function TermsOfUse() {
  useSEO({ title: "Termos de Uso" });
  
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Scale className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="lv-heading-lg">Termos de Uso</h1>
            <p className="lv-caption">Última atualização: 24 de Fevereiro de 2026</p>
          </div>
        </div>

        {/* LGPD notice */}
        <div className="mb-8 lv-card-sm flex gap-3 border-amber-500/20 bg-amber-500/5">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="lv-body-strong text-amber-600 dark:text-amber-400 mb-1">AVISO IMPORTANTE</p>
            <p className="lv-caption">
              A utilização da extensão Starble é de sua total responsabilidade. A extensão NÃO é oficial e não possui vínculo com a Lovable.
              Contas, projetos e dados podem ser bloqueados, suspensos ou excluídos pela Lovable a qualquer momento.
            </p>
          </div>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="lv-heading-sm mb-3">1. Sobre o Serviço</h2>
            <p className="lv-body leading-relaxed">
              O Starble ("plataforma") oferece uma extensão de navegador que permite o envio de mensagens para projetos da plataforma Lovable.
              A extensão utiliza um método não oficial de comunicação e não é endossada, aprovada ou apoiada pela Lovable.
            </p>
          </section>

          <section>
            <h2 className="lv-heading-sm mb-3">2. Aceitação dos Termos</h2>
            <p className="lv-body leading-relaxed">
              Ao criar uma conta, ativar a extensão ou utilizar qualquer funcionalidade da plataforma, o usuário declara ciência e concordância
              integral com todos os termos aqui descritos.
            </p>
          </section>

          <section>
            <h2 className="lv-heading-sm mb-3">3. Riscos e Responsabilidades</h2>
            <ul className="space-y-2">
              {[
                "A extensão NÃO é oficial e pode parar de funcionar a qualquer momento.",
                "O uso pode resultar em bloqueio, suspensão ou exclusão da sua conta Lovable.",
                "O Starble não se responsabiliza por perdas de dados, projetos ou acesso.",
                "Nosso método utiliza a própria plataforma para se comunicar, estando sob risco constante.",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <span className="lv-body">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="lv-heading-sm mb-3">4. Política de Reembolso</h2>
            <p className="lv-body leading-relaxed">
              Não há reembolso em nenhuma hipótese. O serviço é considerado CONCLUÍDO e ENTREGUE a partir do momento da ativação do token.
              O cancelamento ou paralisação temporária do serviço não gera direito a indenização de qualquer natureza.
            </p>
          </section>

          <section>
            <h2 className="lv-heading-sm mb-3">5. Plano Vitalício</h2>
            <p className="lv-body leading-relaxed">
              O plano "Vitalício" oferece acesso enquanto a extensão estiver funcional. Caso a extensão pare de funcionar,
              seja limitada ou descontinuada, NÃO há obrigação de fornecer nova extensão, novo método, créditos ou qualquer tipo de compensação.
            </p>
          </section>

          <section>
            <h2 className="lv-heading-sm mb-3">6. Créditos Lovable</h2>
            <p className="lv-body leading-relaxed">
              Não utilizamos créditos da conta Lovable. Todos os projetos, mensagens e planos criados/enviados através da extensão
              não descontam créditos da sua conta Lovable.
            </p>
          </section>

          <section>
            <h2 className="lv-heading-sm mb-3">7. Proteção de Dados (LGPD)</h2>
            <p className="lv-body leading-relaxed">
              Os dados coletados (email, nome, informações de pagamento) são utilizados exclusivamente para prestação do serviço.
              A ativação da extensão será registrada com dados do dispositivo, IP e localização para fins de comprovação de entrega do serviço.
              O usuário pode solicitar a exclusão de seus dados a qualquer momento através do suporte.
            </p>
          </section>

          <section>
            <h2 className="lv-heading-sm mb-3">8. Programa de Afiliados</h2>
            <p className="lv-body leading-relaxed">
              O programa de afiliados oferece comissão de 30% sobre vendas realizadas através de links de indicação.
              Os pagamentos são processados semanalmente via PIX. O Starble reserva-se o direito de alterar as condições
              do programa a qualquer momento.
            </p>
          </section>

          <section>
            <h2 className="lv-heading-sm mb-3">9. White Label</h2>
            <p className="lv-body leading-relaxed">
              O serviço White Label permite que operadores criem plataformas com marca própria.
              O operador é responsável por seus usuários finais e deve informá-los sobre os riscos envolvidos.
              O Starble não se responsabiliza pela operação de plataformas White Label.
            </p>
          </section>

          <section>
            <h2 className="lv-heading-sm mb-3">10. Modificações</h2>
            <p className="lv-body leading-relaxed">
              Estes termos podem ser alterados a qualquer momento. O uso continuado da plataforma após alterações
              constitui aceite dos novos termos.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border/50">
          <p className="lv-caption text-center">
            Dúvidas? <Link to="/suporte" className="text-primary hover:underline">Entre em contato com nosso suporte</Link>
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
