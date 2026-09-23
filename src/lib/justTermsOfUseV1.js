/**
 * JUST Terms of Use — public Version 1.0 (effective 23 September 2026).
 * Content authority for JUST institutional hosts only (via justLegalPages).
 * Do not paraphrase legal copy. Asaas §9 paragraphs must remain literal.
 */

/** Homologated BaaS clause — KEEP LITERAL (do not normalize corporate names). */
export const ASAAS_FINANCIAL_SERVICES_PARAGRAPHS = Object.freeze([
  "Os serviços financeiros e de pagamentos disponibilizados por meio da presente plataforma, incluindo abertura e manutenção de conta de pagamento, processamento de transações, emissão de boletos, transferências, pagamentos e demais movimentações de valores, são prestados pelo ASAAS GESTÃO FINANCEIRA INSTITUIÇÃO DE PAGAMENTOS S.A., instituição de pagamento autorizada a funcionar pelo Banco Central do Brasil.",
  "A SHEFA MARKETING LTDA atua exclusivamente como integradora tecnológica e distribuidora da experiência do produto, não sendo instituição financeira ou de pagamento, nem realizando intermediação financeira em nome próprio.",
  "O cliente declara ciência de que o relacionamento financeiro/ de pagamentos e a responsabilidade regulatória pelos serviços acima descritos são do ASAAS GESTÃO FINANCEIRA S.A., nos termos da regulamentação vigente.",
])

/**
 * @typedef {{ type: "p", text: string }} LegalP
 * @typedef {{ type: "p", parts: Array<{ text: string, href?: string }> }} LegalPParts
 * @typedef {{ type: "h2", text: string }} LegalH2
 * @typedef {{ type: "h3", text: string }} LegalH3
 * @typedef {{ type: "ul", style: "alpha" | "disc", items: string[] }} LegalUl
 * @typedef {LegalP | LegalPParts | LegalH2 | LegalH3 | LegalUl} LegalBlock
 */

/** @type {readonly LegalBlock[]} */
export const JUST_TERMS_V1_DOCUMENT = Object.freeze([
  {
    type: "p",
    parts: Object.freeze([
      {
        text: "Estes Termos de Uso (“Termos”) regulam o acesso e a utilização da plataforma JUST, operada por SHEFA MARKETING LTDA., inscrita no CNPJ sob nº 48.591.474/0001-81 (“JUST” ou “SHEFA”).",
      },
    ]),
  },
  {
    type: "p",
    parts: Object.freeze([
      {
        text: "Ao contratar, acessar ou utilizar a JUST, o Cliente declara ter lido e concordado com estes Termos e com a ",
      },
      { text: "Política de Privacidade", href: "/privacidade" },
      { text: " aplicável." },
    ]),
  },

  { type: "h2", text: "1. A JUST" },
  { type: "h3", text: "1.1. Objeto" },
  {
    type: "p",
    text: "A JUST é uma plataforma tecnológica disponibilizada no modelo de software como serviço (SaaS), destinada à gestão e operação de atividades empresariais por meio de diferentes módulos, funcionalidades, sites e integrações.",
  },
  { type: "h3", text: "1.2. Módulos e funcionalidades" },
  {
    type: "p",
    text: "Os recursos disponíveis a cada Cliente podem variar conforme o plano, contratação, configuração, módulos habilitados, integrações e estágio de disponibilização de cada funcionalidade.",
  },
  {
    type: "p",
    text: "A existência de determinada funcionalidade na JUST não significa que ela esteja automaticamente incluída ou habilitada para todos os Clientes.",
  },
  { type: "h3", text: "1.3. Definições" },
  { type: "p", text: "Para estes Termos:" },
  {
    type: "ul",
    style: "disc",
    items: Object.freeze([
      "Cliente ou Tenant: pessoa física ou jurídica que contrata ou utiliza a JUST para sua atividade profissional ou empresarial.",
      "Workspace: ambiente lógico do Cliente dentro da JUST.",
      "Usuário: pessoa autorizada a acessar determinado Workspace.",
      "Módulo: conjunto de funcionalidades da JUST que pode ser habilitado para determinado Cliente.",
      "Site: presença digital criada, publicada ou operada por meio da infraestrutura da JUST, quando aplicável.",
      "Conteúdo do Cliente: textos, imagens, vídeos, marcas, logotipos, identidade visual, catálogos, documentos, informações e demais materiais fornecidos ou inseridos pelo Cliente ou de sua titularidade ou responsabilidade.",
      "Serviços de Terceiros: serviços, sistemas ou infraestrutura de terceiros utilizados ou integrados à JUST.",
    ]),
  },

  { type: "h2", text: "2. Cadastro, Workspace e usuários" },
  { type: "h3", text: "2.1." },
  {
    type: "p",
    text: "O Cliente deverá fornecer informações verdadeiras, completas e atualizadas sempre que necessárias à contratação, configuração ou utilização da JUST.",
  },
  { type: "h3", text: "2.2." },
  {
    type: "p",
    text: "O Cliente é responsável por determinar quem poderá acessar seu Workspace e por administrar adequadamente os usuários, permissões e acessos sob seu controle.",
  },
  { type: "h3", text: "2.3." },
  {
    type: "p",
    text: "As credenciais de acesso são pessoais e devem ser protegidas contra utilização indevida. O Cliente e seus Usuários não deverão compartilhar credenciais de maneira que permita acesso não autorizado à plataforma.",
  },
  { type: "h3", text: "2.4." },
  {
    type: "p",
    text: "O Cliente deverá comunicar à JUST, tão logo tome conhecimento, qualquer suspeita relevante de acesso não autorizado à sua conta ou Workspace.",
  },

  { type: "h2", text: "3. Utilização da plataforma" },
  {
    type: "p",
    text: "O Cliente compromete-se a utilizar a JUST de maneira lícita e compatível com estes Termos, sendo responsável pelas atividades realizadas no contexto de seu negócio por meio da plataforma.",
  },
  { type: "p", text: "O Cliente é responsável, conforme aplicável:" },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "pela veracidade das informações que fornecer;",
      "pelos Usuários que autorizar a acessar seu Workspace;",
      "pelos conteúdos, informações e dados que inserir ou determinar que sejam tratados pela plataforma;",
      "pela legitimidade da utilização de dados relativos a seus clientes, leads, fornecedores, contatos, pagadores e demais terceiros;",
      "pela observância das obrigações legais e contratuais aplicáveis à sua própria atividade; e",
      "pela obtenção das autorizações, licenças e direitos necessários sobre materiais que disponibilizar na JUST.",
    ]),
  },

  { type: "h2", text: "4. Usos proibidos" },
  { type: "p", text: "Não é permitido utilizar a JUST para:" },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "praticar fraude, ilícitos ou atividades que violem direitos de terceiros;",
      "acessar ou tentar acessar sistemas, dados, contas ou ambientes sem autorização;",
      "interferir no funcionamento, segurança ou integridade da plataforma;",
      "explorar deliberadamente vulnerabilidades ou mecanismos de segurança;",
      "transmitir vírus, malware ou outros códigos prejudiciais;",
      "utilizar os serviços de maneira abusiva ou incompatível com sua finalidade;",
      "copiar, reproduzir, extrair, realizar engenharia reversa ou buscar acesso ao código-fonte, componentes internos ou tecnologia proprietária da JUST, ressalvadas as hipóteses expressamente permitidas pela legislação aplicável; ou",
      "utilizar a plataforma para violar propriedade intelectual, privacidade ou outros direitos de terceiros.",
    ]),
  },

  { type: "h2", text: "5. Sites operados pela JUST" },
  { type: "h3", text: "5.1. Natureza do serviço" },
  {
    type: "p",
    text: "Quando o Cliente contratar ou utilizar funcionalidades de site, a JUST disponibilizará a presença digital correspondente por meio de sua plataforma, tecnologia e infraestrutura.",
  },
  {
    type: "p",
    text: "A contratação concede ao Cliente o direito de utilização do site durante a vigência do serviço correspondente, nos termos da contratação aplicável.",
  },
  { type: "h3", text: "5.2. Conteúdo do Cliente" },
  {
    type: "p",
    text: "O Cliente mantém os direitos que possua sobre seu Conteúdo, incluindo, conforme aplicável, textos, fotografias, vídeos, logotipos, marcas, identidade visual, catálogos e demais materiais próprios.",
  },
  {
    type: "p",
    text: "O Cliente autoriza a JUST, durante a prestação dos serviços e na medida necessária para sua execução, a armazenar, processar, reproduzir, adaptar tecnicamente e disponibilizar esses materiais.",
  },
  {
    type: "p",
    text: "Essa autorização não transfere à JUST a propriedade do Conteúdo do Cliente.",
  },
  { type: "h3", text: "5.3. Tecnologia da JUST" },
  {
    type: "p",
    text: "O software, código-fonte, arquitetura, componentes, bibliotecas, templates, motores de renderização, sistemas, ferramentas, infraestrutura, métodos, interfaces e demais ativos tecnológicos utilizados para produzir e operar o site permanecem de titularidade da SHEFA/JUST ou de seus respectivos licenciadores.",
  },
  { type: "h3", text: "5.4. Não transferência do código" },
  {
    type: "p",
    text: "A contratação de um site por meio da JUST não constitui compra, venda ou cessão de seu código-fonte ou da tecnologia utilizada para sua operação.",
  },
  {
    type: "p",
    text: "O Cliente não adquire direito de acesso aos repositórios, código-fonte, infraestrutura interna ou componentes tecnológicos da JUST, nem direito de exigir que a implementação tecnológica do site seja transferida para servidor, infraestrutura ou plataforma externa.",
  },
  { type: "h3", text: "5.5. Encerramento, conteúdo e exportação" },
  {
    type: "p",
    text: "O encerramento da contratação não altera a titularidade do Conteúdo do Cliente.",
  },
  {
    type: "p",
    text: "Quando tecnicamente disponível, a JUST poderá fornecer ou exportar determinados dados ou conteúdos pertencentes ao Cliente em formato razoável.",
  },
  {
    type: "p",
    text: "Essa possibilidade não constitui promessa de ferramenta automática ou universal de exportação, de portabilidade integral automatizada ou de fornecimento de todos os dados em qualquer formato específico.",
  },
  {
    type: "p",
    text: "Em nenhuma hipótese essa possibilidade inclui código-fonte, arquitetura, templates, componentes, infraestrutura ou demais ativos tecnológicos da JUST.",
  },
  { type: "h3", text: "5.6. Domínio" },
  {
    type: "p",
    text: "Quando o domínio utilizado pelo site for de titularidade do Cliente, essa titularidade é independente da tecnologia utilizada pela JUST para produzir e operar o site.",
  },
  {
    type: "p",
    text: "A utilização de domínio de titularidade do Cliente na JUST não transfere à plataforma a propriedade desse domínio.",
  },

  { type: "h2", text: "6. Propriedade intelectual da JUST" },
  {
    type: "p",
    text: "A contratação da JUST concede ao Cliente direito limitado, não exclusivo e vinculado à vigência da contratação para utilizar as funcionalidades disponibilizadas em seu Workspace.",
  },
  {
    type: "p",
    text: "Não há transferência ao Cliente da propriedade sobre a plataforma, marca JUST, software, código, arquitetura, interfaces, documentação, componentes ou demais ativos intelectuais ou tecnológicos da SHEFA/JUST.",
  },
  {
    type: "p",
    text: "Nada nesta cláusula transfere à JUST a propriedade do Conteúdo do Cliente.",
  },

  { type: "h2", text: "7. Dados inseridos pelo Cliente" },
  {
    type: "p",
    text: "A utilização da JUST pode envolver dados relativos aos próprios Usuários do Cliente e a pessoas relacionadas à sua atividade, incluindo clientes, leads, fornecedores, contatos e pagadores.",
  },
  {
    type: "p",
    text: "O Cliente é responsável pela legitimidade da coleta e utilização dos dados que inserir ou determinar que sejam tratados em seu Workspace e pelas instruções relacionadas ao tratamento desses dados no contexto de sua atividade.",
  },
  {
    type: "p",
    parts: Object.freeze([
      {
        text: "A JUST tratará tais informações para disponibilizar e operar as funcionalidades contratadas, observadas a legislação aplicável e sua ",
      },
      { text: "Política de Privacidade", href: "/privacidade" },
      { text: "." },
    ]),
  },

  { type: "h2", text: "8. Integrações e serviços de terceiros" },
  { type: "h3", text: "8.1." },
  {
    type: "p",
    text: "Determinadas funcionalidades da JUST dependem ou podem depender de serviços e infraestrutura fornecidos por terceiros.",
  },
  { type: "h3", text: "8.2." },
  {
    type: "p",
    text: "Algumas integrações podem exigir que o Cliente mantenha cadastro, conta, autorização ou relacionamento diretamente com o respectivo prestador.",
  },
  { type: "h3", text: "8.3." },
  {
    type: "p",
    text: "Os serviços de terceiros podem estar sujeitos a seus próprios termos, políticas, condições técnicas e regras de disponibilidade.",
  },
  { type: "h3", text: "8.4." },
  {
    type: "p",
    text: "Alterações, restrições ou indisponibilidades em serviços de terceiros poderão afetar funcionalidades da JUST que dependam desses serviços.",
  },

  { type: "h2", text: "9. Prestação de Serviços Financeiros" },
  { type: "p", text: ASAAS_FINANCIAL_SERVICES_PARAGRAPHS[0] },
  { type: "p", text: ASAAS_FINANCIAL_SERVICES_PARAGRAPHS[1] },
  { type: "p", text: ASAAS_FINANCIAL_SERVICES_PARAGRAPHS[2] },

  { type: "h2", text: "10. Preços e cobrança" },
  { type: "h3", text: "10.1." },
  {
    type: "p",
    text: "Os valores, periodicidade, módulos e demais condições comerciais da JUST serão aqueles estabelecidos na contratação, proposta, plano ou condição comercial aplicável ao Cliente.",
  },
  { type: "h3", text: "10.2." },
  {
    type: "p",
    text: "A contratação da JUST e as tarifas eventualmente cobradas por prestadores de serviços financeiros ou outros terceiros são relações distintas, ainda que determinados valores possam ser apresentados ou processados de maneira integrada.",
  },
  { type: "h3", text: "10.3." },
  {
    type: "p",
    text: "Serviços, módulos ou funcionalidades adicionais poderão possuir preços próprios, conforme informado ao Cliente antes de sua contratação ou habilitação, quando aplicável.",
  },

  { type: "h2", text: "11. Inadimplência" },
  { type: "h3", text: "11.1." },
  {
    type: "p",
    text: "O não pagamento de valores devidos à JUST caracteriza inadimplência a partir do respectivo vencimento.",
  },
  { type: "h3", text: "11.2." },
  {
    type: "p",
    text: "Durante os 7 (sete) dias corridos subsequentes ao vencimento, a JUST poderá realizar comunicações relacionadas à pendência e à sua regularização.",
  },
  { type: "h3", text: "11.3." },
  {
    type: "p",
    text: "Transcorridos 7 (sete) dias corridos do vencimento sem regularização, a JUST poderá, conforme o caso, restringir funcionalidades, suspender módulos ou suspender o acesso do Cliente à plataforma até a regularização.",
  },
  {
    type: "p",
    text: "O prazo acima estabelece uma condição contratual para a possibilidade de suspensão e não representa promessa de que a suspensão ocorrerá automaticamente ou necessariamente no oitavo dia.",
  },
  { type: "h3", text: "11.4." },
  {
    type: "p",
    text: "A regularização permitirá o restabelecimento dos serviços, observados os procedimentos e tempos necessários ao processamento operacional do pagamento.",
  },
  { type: "h3", text: "11.5." },
  {
    type: "p",
    text: "A suspensão por inadimplência não implica exclusão automática dos dados do Cliente.",
  },

  { type: "h2", text: "12. Suspensão por outras causas" },
  {
    type: "p",
    text: "Independentemente do prazo previsto para inadimplência, a JUST poderá restringir ou suspender o acesso quando necessário em razão de:",
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "indícios relevantes de fraude ou atividade ilícita;",
      "risco à segurança da plataforma, de seus Usuários ou de terceiros;",
      "violação relevante destes Termos;",
      "tentativa de acesso não autorizado ou comprometimento dos sistemas;",
      "obrigação legal, judicial ou regulatória; ou",
      "utilização que possa causar prejuízo relevante à plataforma ou a terceiros.",
    ]),
  },
  {
    type: "p",
    text: "Sempre que razoavelmente possível e compatível com a natureza da situação, a JUST buscará comunicar o Cliente.",
  },

  { type: "h2", text: "13. Cancelamento e encerramento" },
  { type: "h3", text: "13.1." },
  {
    type: "p",
    text: "O Cliente poderá solicitar o encerramento de sua contratação conforme as condições comerciais aplicáveis.",
  },
  { type: "h3", text: "13.2." },
  {
    type: "p",
    text: "Com o encerramento, cessa o direito do Cliente de utilizar os serviços e funcionalidades correspondentes.",
  },
  { type: "h3", text: "13.3." },
  {
    type: "p",
    parts: Object.freeze([
      {
        text: "O encerramento não implica exclusão instantânea de todos os dados. Determinadas informações poderão ser mantidas quando necessárias ao cumprimento de obrigações legais ou regulatórias, exercício regular de direitos, segurança ou outras finalidades legitimamente aplicáveis, conforme a ",
      },
      { text: "Política de Privacidade", href: "/privacidade" },
      { text: "." },
    ]),
  },
  { type: "h3", text: "13.4." },
  {
    type: "p",
    text: "O encerramento não confere ao Cliente direito ao código-fonte, arquitetura, infraestrutura, componentes ou demais ativos tecnológicos da JUST.",
  },

  { type: "h2", text: "14. Disponibilidade, manutenção e evolução" },
  { type: "h3", text: "14.1." },
  {
    type: "p",
    text: "A JUST busca manter seus serviços disponíveis e adequados ao uso a que se destinam, mas não garante funcionamento ininterrupto ou livre de falhas.",
  },
  { type: "h3", text: "14.2." },
  {
    type: "p",
    text: "Poderão ocorrer indisponibilidades decorrentes, entre outros fatores, de manutenção, atualização, falhas técnicas, incidentes, serviços de terceiros ou circunstâncias fora do controle razoável da JUST.",
  },
  { type: "h3", text: "14.3." },
  {
    type: "p",
    text: "A JUST poderá corrigir, atualizar, modificar e evoluir a plataforma, seus componentes, interfaces e funcionalidades ao longo do tempo.",
  },
  { type: "h3", text: "14.4." },
  {
    type: "p",
    text: "Eventuais níveis específicos de serviço ou disponibilidade somente serão aplicáveis quando expressamente contratados em instrumento próprio.",
  },

  { type: "h2", text: "15. Responsabilidades" },
  {
    type: "p",
    text: "A JUST é responsável pela prestação dos serviços tecnológicos que lhe competem nos termos da contratação e da legislação aplicável.",
  },
  {
    type: "p",
    text: "O Cliente permanece responsável por sua própria atividade empresarial, por suas decisões comerciais e operacionais, pelo Conteúdo do Cliente, pelos Usuários que autorizar e pelos dados cuja utilização determinar dentro de seu negócio.",
  },
  {
    type: "p",
    text: "A utilização da JUST não transfere à SHEFA/JUST as obrigações legais, profissionais, fiscais, comerciais ou regulatórias próprias da atividade do Cliente.",
  },
  {
    type: "p",
    text: "Serviços prestados diretamente por terceiros permanecem sujeitos às responsabilidades do respectivo prestador, sem prejuízo das responsabilidades que a legislação aplicável atribua à JUST.",
  },

  { type: "h2", text: "16. Privacidade e proteção de dados" },
  {
    type: "p",
    parts: Object.freeze([
      {
        text: "O tratamento de dados pessoais relacionado à JUST observará sua ",
      },
      { text: "Política de Privacidade", href: "/privacidade" },
      { text: " e a legislação aplicável." },
    ]),
  },
  {
    type: "p",
    text: "O Cliente deverá igualmente observar a legislação de proteção de dados em relação às informações que coletar, inserir ou tratar por meio da JUST no contexto de sua própria atividade.",
  },
  {
    type: "p",
    text: "Solicitações relacionadas à privacidade poderão ser encaminhadas para privacidade@justwebsites.com.br.",
  },

  { type: "h2", text: "17. Comunicações" },
  {
    type: "p",
    text: "A JUST poderá utilizar os canais de contato informados pelo Cliente, bem como a própria plataforma, para comunicações necessárias à prestação dos serviços, incluindo avisos administrativos, operacionais, de segurança, cobrança e alterações relevantes da relação contratual.",
  },
  {
    type: "p",
    text: "Comunicações necessárias à execução do serviço não se confundem com comunicações promocionais ou de marketing.",
  },

  { type: "h2", text: "18. Alterações destes Termos" },
  {
    type: "p",
    text: "A JUST poderá atualizar estes Termos para refletir alterações legais, regulatórias, técnicas, operacionais ou relacionadas aos serviços.",
  },
  {
    type: "p",
    text: "Alterações relevantes serão comunicadas por meio razoável, como plataforma ou e-mail, com indicação de sua vigência quando aplicável.",
  },
  {
    type: "p",
    text: "Quando determinada alteração exigir, nos termos da legislação aplicável, nova manifestação ou consentimento do Cliente, a JUST adotará o procedimento correspondente.",
  },

  { type: "h2", text: "19. Disposições gerais" },
  { type: "h3", text: "19.1." },
  {
    type: "p",
    text: "A eventual invalidade ou inexigibilidade de determinada disposição destes Termos não afetará as demais disposições, que permanecerão válidas na máxima extensão permitida.",
  },
  { type: "h3", text: "19.2." },
  {
    type: "p",
    text: "A eventual tolerância de uma das partes quanto ao descumprimento de obrigação não constitui renúncia ao direito de exigir seu cumprimento posteriormente.",
  },
  { type: "h3", text: "19.3." },
  {
    type: "p",
    parts: Object.freeze([
      {
        text: "Estes Termos devem ser interpretados em conjunto com a contratação comercial aplicável e com a ",
      },
      { text: "Política de Privacidade", href: "/privacidade" },
      { text: "." },
    ]),
  },

  { type: "h2", text: "20. Lei aplicável e foro" },
  {
    type: "p",
    text: "Estes Termos são regidos pelas leis da República Federativa do Brasil.",
  },
  {
    type: "p",
    text: "Fica eleito o foro da Comarca de São Paulo, Estado de São Paulo, para dirimir controvérsias relacionadas a estes Termos, ressalvadas as hipóteses em que a legislação aplicável estabeleça competência diversa de forma obrigatória.",
  },

  { type: "h2", text: "21. Contato" },
  {
    type: "p",
    text: "Dúvidas relacionadas aos serviços ou à relação contratual poderão ser encaminhadas pelos canais oficiais de atendimento da JUST.",
  },
  {
    type: "p",
    text: "Para assuntos relacionados à privacidade e proteção de dados:",
  },
  { type: "p", text: "privacidade@justwebsites.com.br" },
  { type: "p", text: "SHEFA MARKETING LTDA." },
  { type: "p", text: "CNPJ 48.591.474/0001-81" },
  { type: "p", text: "Operadora da plataforma JUST." },
])

export const justTermsOfUseV1 = Object.freeze({
  slug: "termos",
  title: "Termos de Uso da JUST",
  version: "1.0",
  effectiveDateLabel: "23 de setembro de 2026",
  document: JUST_TERMS_V1_DOCUMENT,
})
