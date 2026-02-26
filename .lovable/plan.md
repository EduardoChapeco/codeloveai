
<plan_summary>
Configurar a secret `LOVABLE_FIREBASE_API_KEY` no projeto para habilitar o auto-refresh de tokens Firebase/Lovable.
</plan_summary>

<plan_steps>
<plan_step>
Adicionar a secret `LOVABLE_FIREBASE_API_KEY` usando a ferramenta de secrets. O valor deve ser a chave Firebase do Lovable (formato `AIzaSy...`), que você pode obter abrindo o DevTools no site lovable.dev e inspecionando uma requisição para `securetoken.googleapis.com` — o parâmetro `key=` na URL contém a chave.
</plan_step>
</plan_steps>
