/**
 * JUST Privacy Policy — public Version 1.0 (effective 23 September 2026).
 * Content authority for JUST institutional hosts only (via justLegalPages).
 * Frozen copy — do not paraphrase or edit legal text.
 */

/**
 * @typedef {{ type: "p", text: string }} LegalP
 * @typedef {{ type: "p", parts: Array<{ text: string, href?: string }> }} LegalPParts
 * @typedef {{ type: "h2", text: string }} LegalH2
 * @typedef {{ type: "h3", text: string }} LegalH3
 * @typedef {{ type: "ul", style: "alpha" | "disc", items: string[] }} LegalUl
 * @typedef {LegalP | LegalPParts | LegalH2 | LegalH3 | LegalUl} LegalBlock
 */

/** @type {readonly LegalBlock[]} */
export const JUST_PRIVACY_V1_DOCUMENT = Object.freeze([
  {
    type: "p",
    text: "Esta Política de Privacidade (“Política”) descreve como a SHEFA MARKETING LTDA., inscrita no CNPJ sob nº 48.591.474/0001-81, operadora da plataforma JUST (“JUST” ou “SHEFA”), trata dados pessoais relacionados à utilização de seus serviços, sites e plataforma.",
  },
  {
    type: "p",
    text: "Esta Política deve ser lida em conjunto com os Termos de Uso da JUST e aplica-se ao tratamento de dados pessoais realizado pela JUST no contexto de suas próprias atividades.",
  },
  {
    type: "p",
    text: "Quando um Cliente utiliza a JUST para tratar dados pessoais relacionados à sua própria atividade empresarial, os papéis e responsabilidades podem variar conforme a operação realizada, conforme explicado abaixo.",
  },
  { type: "h2", text: "1. A quem esta Política se aplica" },
  {
    type: "p",
    text: "Esta Política pode se aplicar a dados pessoais relacionados a:",
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "Clientes e potenciais clientes da JUST;",
    ]),
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "representantes, administradores e colaboradores dos Clientes;",
    ]),
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "Usuários autorizados a acessar Workspaces da JUST;",
    ]),
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "pessoas que entram em contato com a JUST;",
    ]),
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "visitantes dos sites e páginas operados pela JUST; e",
    ]),
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "outras pessoas cujos dados sejam tratados pela JUST no contexto de suas próprias atividades.",
    ]),
  },
  {
    type: "p",
    text: "A plataforma também permite que seus Clientes tratem dados relacionados a seus próprios clientes, leads, fornecedores, contatos, pagadores e outras pessoas. Nessas situações, o Cliente poderá ser o responsável pelas decisões relacionadas a esse tratamento, conforme a legislação aplicável.",
  },
  { type: "h2", text: "2. Quais dados pessoais podemos tratar" },
  {
    type: "p",
    text: "Os dados tratados pela JUST variam conforme os serviços utilizados, as funcionalidades habilitadas e a forma de interação com a plataforma.",
  },
  { type: "h3", text: "2.1. Dados cadastrais e de identificação" },
  {
    type: "p",
    text: "Podemos tratar informações como:",
  },
  {
    type: "ul",
    style: "disc",
    items: Object.freeze([
      "nome;",
      "e-mail;",
      "telefone;",
      "CPF ou CNPJ, quando aplicável;",
      "informações relacionadas à empresa ou atividade profissional;",
      "informações necessárias à identificação do Cliente, representante ou Usuário.",
    ]),
  },
  { type: "h3", text: "2.2. Dados de autenticação e acesso" },
  {
    type: "p",
    text: "Podemos tratar informações necessárias para autenticação, gerenciamento de sessão e controle de acesso aos Workspaces.",
  },
  {
    type: "p",
    text: "A autenticação da plataforma utiliza infraestrutura especializada de terceiros. A JUST não mantém a senha do Usuário em campos próprios de sua aplicação destinados ao armazenamento de senhas em texto legível.",
  },
  {
    type: "p",
    text: "Quando disponibilizado, o acesso também poderá ocorrer por meio de provedores de autenticação de terceiros, como Google.",
  },
  { type: "h3", text: "2.3. Dados de contato e relacionamento" },
  {
    type: "p",
    text: "Podemos tratar dados e registros relacionados a:",
  },
  {
    type: "ul",
    style: "disc",
    items: Object.freeze([
      "solicitações de suporte;",
      "comunicações operacionais;",
      "atendimento;",
      "configuração dos serviços;",
      "relacionamento comercial;",
      "cobrança e administração da contratação.",
    ]),
  },
  { type: "h3", text: "2.4. Dados inseridos pelo Cliente na plataforma" },
  {
    type: "p",
    text: "Dependendo dos módulos utilizados, o Cliente poderá inserir ou determinar o tratamento de dados relacionados à sua própria operação, incluindo informações de clientes, leads, fornecedores, contatos, pagadores e outras pessoas relacionadas ao seu negócio.",
  },
  {
    type: "p",
    text: "O tipo de informação tratada dependerá das funcionalidades efetivamente utilizadas pelo Cliente.",
  },
  { type: "h3", text: "2.5. Dados relacionados a sites e interações digitais" },
  {
    type: "p",
    text: "Quando o Cliente utiliza funcionalidades de site, formulários, captação de contatos ou recursos relacionados, poderão ser tratados dados fornecidos pelos visitantes ou gerados durante essas interações.",
  },
  {
    type: "p",
    text: "Isso pode incluir, conforme o caso:",
  },
  {
    type: "ul",
    style: "disc",
    items: Object.freeze([
      "informações fornecidas em formulários;",
      "dados de contato;",
      "informações técnicas do acesso;",
      "eventos relacionados à utilização do site; e",
      "informações necessárias para geração de métricas operacionais.",
    ]),
  },
  { type: "h3", text: "2.6. Dados financeiros e transacionais" },
  {
    type: "p",
    text: "Quando o Cliente utiliza módulos financeiros, a JUST poderá tratar informações relacionadas à gestão financeira e ao estado de cobranças e transações, como valores, vencimentos, identificação de cobranças, situação de pagamentos e meio de pagamento utilizado.",
  },
  {
    type: "p",
    text: "A JUST não possui campos próprios destinados ao armazenamento de números completos de cartão (PAN) ou códigos de segurança (CVV).",
  },
  {
    type: "p",
    text: "Determinados serviços financeiros e de pagamento são prestados por terceiros especializados, conforme descrito nesta Política e nos Termos de Uso.",
  },
  { type: "h3", text: "2.7. Dados técnicos e de utilização" },
  {
    type: "p",
    text: "Podemos tratar informações técnicas necessárias à operação, segurança e compreensão da utilização dos serviços, como:",
  },
  {
    type: "ul",
    style: "disc",
    items: Object.freeze([
      "informações de sessão;",
      "identificadores técnicos;",
      "dados relacionados ao Workspace;",
      "informações sobre navegação e utilização de funcionalidades;",
      "eventos de utilização;",
      "informações do navegador ou dispositivo, quando disponibilizadas tecnicamente; e",
      "registros necessários à segurança e diagnóstico da plataforma.",
    ]),
  },
  { type: "h2", text: "3. Dados relacionados à integração com o Asaas" },
  {
    type: "p",
    text: "A JUST integra determinados serviços financeiros e de pagamentos prestados pelo Asaas.",
  },
  {
    type: "p",
    text: "No processo de abertura ou integração de uma conta Asaas por meio da JUST, determinadas informações fornecidas pelo Cliente podem ser encaminhadas ao Asaas para viabilizar a solicitação e o relacionamento correspondente.",
  },
  {
    type: "p",
    text: "Essas informações podem incluir, conforme o tipo de conta e os requisitos aplicáveis, dados de identificação, contato, endereço e outras informações solicitadas para o processo de abertura.",
  },
  {
    type: "p",
    text: "O fato de uma informação transitar tecnicamente pela JUST para sua transmissão ao Asaas não significa que todos esses dados sejam mantidos pela JUST como cadastro permanente ou para finalidades próprias.",
  },
  {
    type: "p",
    text: "Após a abertura ou conexão da conta, determinadas informações técnicas necessárias à integração podem ser mantidas pela JUST. Credenciais de integração do Cliente utilizadas pela plataforma são armazenadas de forma protegida, conforme a arquitetura técnica aplicável.",
  },
  {
    type: "p",
    text: "Os serviços financeiros e de pagamentos são prestados pelo Asaas nos termos descritos nos Termos de Uso da JUST e estão também sujeitos às condições e políticas aplicáveis ao relacionamento entre o Cliente e o Asaas.",
  },
  { type: "h2", text: "4. Para quais finalidades utilizamos dados pessoais" },
  {
    type: "p",
    text: "A JUST poderá tratar dados pessoais, conforme aplicável, para:",
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "cadastrar e identificar Clientes e Usuários;",
    ]),
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "autenticar acessos e administrar sessões;",
    ]),
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "criar, configurar e operar Workspaces;",
    ]),
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "disponibilizar módulos e funcionalidades contratados;",
    ]),
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "operar sites e recursos digitais disponibilizados por meio da JUST;",
    ]),
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "processar informações necessárias às integrações solicitadas pelo Cliente;",
    ]),
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "permitir a utilização de funcionalidades financeiras e administrativas;",
    ]),
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "prestar suporte e responder solicitações;",
    ]),
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "enviar comunicações administrativas, operacionais, de segurança e cobrança;",
    ]),
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "prevenir fraude, abuso e acesso não autorizado;",
    ]),
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "investigar falhas e incidentes;",
    ]),
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "proteger a segurança e integridade da plataforma;",
    ]),
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "cumprir obrigações legais, regulatórias ou ordens de autoridades competentes;",
    ]),
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "exercer ou defender direitos em processos judiciais, administrativos ou arbitrais;",
    ]),
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "administrar a relação contratual com o Cliente; e",
    ]),
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "analisar a utilização e melhorar a operação, desempenho e experiência dos serviços, quando aplicável.",
    ]),
  },
  { type: "h2", text: "5. Bases legais" },
  {
    type: "p",
    text: "O tratamento de dados pessoais pela JUST será realizado com fundamento nas bases legais aplicáveis a cada situação, nos termos da legislação de proteção de dados.",
  },
  {
    type: "p",
    text: "Conforme o contexto, essas bases podem incluir:",
  },
  {
    type: "ul",
    style: "disc",
    items: Object.freeze([
      "execução de contrato ou procedimentos relacionados à contratação;",
      "cumprimento de obrigação legal ou regulatória;",
      "exercício regular de direitos;",
      "legítimo interesse da JUST ou de terceiros, quando aplicável e observados os direitos e liberdades do titular; e",
      "consentimento, quando essa for a base legal adequada e exigível para determinada finalidade.",
    ]),
  },
  {
    type: "p",
    text: "A aplicação de uma base legal depende da natureza dos dados, da finalidade e do contexto específico do tratamento.",
  },
  { type: "h2", text: "6. Dados tratados em nome dos Clientes" },
  {
    type: "p",
    text: "A JUST disponibiliza infraestrutura tecnológica que permite aos Clientes tratar dados relacionados às suas próprias atividades.",
  },
  {
    type: "p",
    text: "Nessas situações, o Cliente poderá determinar quais dados serão inseridos na plataforma, para quais finalidades serão utilizados e quais pessoas terão acesso a eles.",
  },
  {
    type: "p",
    text: "Quando a JUST tratar dados pessoais seguindo essas determinações para prestar os serviços contratados, sua atuação ocorrerá no contexto da prestação tecnológica ao Cliente, sem assumir as decisões empresariais próprias do Cliente sobre a utilização desses dados.",
  },
  {
    type: "p",
    text: "O Cliente é responsável por assegurar que possui fundamento adequado para coletar, utilizar e inserir esses dados na JUST e por fornecer aos titulares as informações exigidas pela legislação aplicável.",
  },
  { type: "h2", text: "7. Com quem podemos compartilhar dados" },
  {
    type: "p",
    text: "A JUST poderá compartilhar ou permitir o tratamento de dados por terceiros quando isso for necessário para disponibilizar seus serviços, executar integrações, cumprir obrigações ou operar sua infraestrutura.",
  },
  {
    type: "p",
    text: "Isso pode incluir:",
  },
  { type: "h3", text: "7.1. Asaas" },
  {
    type: "p",
    text: "Para prestação de serviços financeiros e de pagamentos, incluindo abertura e manutenção de conta de pagamento, cobranças, processamento de transações e demais serviços financeiros disponibilizados por meio da integração.",
  },
  { type: "h3", text: "7.2. Provedores de infraestrutura e tecnologia" },
  {
    type: "p",
    text: "A JUST utiliza prestadores especializados para funções necessárias à operação da plataforma, incluindo serviços de infraestrutura, hospedagem, autenticação, banco de dados, distribuição de conteúdo e segurança.",
  },
  {
    type: "p",
    text: "Entre os provedores utilizados pela arquitetura da JUST podem estar Supabase e Cloudflare, conforme os serviços e componentes técnicos utilizados.",
  },
  { type: "h3", text: "7.3. Provedores de autenticação" },
  {
    type: "p",
    text: "Quando o Usuário optar por método de autenticação disponibilizado por terceiro, como Google, determinadas informações necessárias à autenticação poderão ser tratadas pelo respectivo provedor e pela JUST.",
  },
  { type: "h3", text: "7.4. Autoridades e cumprimento legal" },
  {
    type: "p",
    text: "Dados poderão ser disponibilizados quando necessário para cumprimento de obrigação legal ou regulatória, ordem judicial ou determinação válida de autoridade competente, ou para exercício regular de direitos.",
  },
  { type: "h3", text: "7.5. Outros prestadores necessários" },
  {
    type: "p",
    text: "A JUST poderá utilizar outros fornecedores para atividades necessárias à operação de seus serviços.",
  },
  {
    type: "p",
    text: "Nesses casos, buscamos limitar o tratamento às informações necessárias para a finalidade correspondente e adotar medidas contratuais e técnicas adequadas ao contexto.",
  },
  {
    type: "p",
    text: "A JUST não comercializa dados pessoais como atividade de venda de bases de dados.",
  },
  { type: "h2", text: "8. Cookies, armazenamento local e tecnologias semelhantes" },
  {
    type: "p",
    text: "A JUST utiliza mecanismos técnicos necessários ao funcionamento de sua plataforma e de seus sites.",
  },
  {
    type: "p",
    text: "Esses mecanismos podem incluir cookies, armazenamento local do navegador e tecnologias semelhantes para finalidades como:",
  },
  {
    type: "ul",
    style: "disc",
    items: Object.freeze([
      "manter sessões autenticadas;",
      "permitir funcionamento da navegação;",
      "armazenar preferências operacionais;",
      "identificar o Workspace ou contexto de utilização;",
      "proteger e operar os serviços.",
    ]),
  },
  {
    type: "p",
    text: "A JUST também pode utilizar métricas e analytics próprios para compreender a utilização de determinados sites ou funcionalidades, quando esses recursos estiverem habilitados.",
  },
  {
    type: "p",
    text: "Esses dados podem incluir informações relacionadas a sessões, páginas acessadas e eventos de utilização.",
  },
  {
    type: "p",
    text: "A disponibilidade e utilização desses mecanismos podem variar conforme o site, módulo e funcionalidades habilitados.",
  },
  { type: "h2", text: "9. Transferências e processamento internacional" },
  {
    type: "p",
    text: "Alguns fornecedores de tecnologia utilizados pela JUST podem operar infraestrutura, empresas ou serviços em diferentes países.",
  },
  {
    type: "p",
    text: "Consequentemente, determinados dados pessoais poderão ser processados fora do Brasil quando isso decorrer da infraestrutura ou do serviço utilizado.",
  },
  {
    type: "p",
    text: "Quando aplicável, a JUST buscará observar os requisitos previstos na legislação brasileira para transferências internacionais de dados e adotar salvaguardas compatíveis com a natureza do tratamento.",
  },
  {
    type: "p",
    text: "Esta Política não implica que todos os dados da JUST sejam armazenados ou processados em determinada região geográfica específica.",
  },
  { type: "h2", text: "10. Segurança da informação" },
  {
    type: "p",
    text: "A JUST adota medidas técnicas e organizacionais destinadas a proteger os dados tratados pela plataforma contra acessos não autorizados e situações acidentais ou ilícitas de destruição, perda, alteração ou divulgação.",
  },
  {
    type: "p",
    text: "As medidas adotadas podem variar conforme a natureza dos dados, funcionalidade e infraestrutura envolvidas.",
  },
  {
    type: "p",
    text: "Entre os mecanismos utilizados pela arquitetura da plataforma estão controles de autenticação, autorização e segregação lógica entre ambientes de Clientes, além de mecanismos de proteção de determinadas credenciais de integração.",
  },
  {
    type: "p",
    text: "Nenhum sistema conectado à internet pode garantir segurança absoluta. Por esse motivo, a adoção de medidas de segurança reduz riscos, mas não elimina integralmente a possibilidade de incidentes.",
  },
  {
    type: "p",
    text: "O Cliente também é responsável por proteger suas credenciais, administrar adequadamente seus Usuários e permissões e comunicar à JUST suspeitas relevantes de acesso indevido.",
  },
  { type: "h2", text: "11. Retenção dos dados" },
  {
    type: "p",
    text: "Os dados pessoais poderão ser mantidos pelo período necessário para cumprir as finalidades para as quais foram tratados e enquanto houver fundamento legítimo para sua manutenção.",
  },
  {
    type: "p",
    text: "Os períodos de retenção podem variar de acordo com:",
  },
  {
    type: "ul",
    style: "disc",
    items: Object.freeze([
      "natureza da informação;",
      "finalidade do tratamento;",
      "duração da relação contratual;",
      "necessidade operacional;",
      "obrigações legais ou regulatórias;",
      "prevenção de fraude e segurança; e",
      "necessidade de exercício regular de direitos.",
    ]),
  },
  {
    type: "p",
    text: "O encerramento da contratação ou a exclusão de determinado registro da interface da plataforma não implica necessariamente eliminação imediata de todas as informações relacionadas.",
  },
  {
    type: "p",
    text: "Após o término da finalidade aplicável, os dados poderão ser eliminados, anonimizados ou mantidos quando houver fundamento legal para sua conservação.",
  },
  { type: "h2", text: "12. Direitos dos titulares" },
  {
    type: "p",
    text: "Nos termos da legislação aplicável, o titular poderá exercer os direitos que lhe sejam assegurados em relação aos seus dados pessoais, incluindo, conforme aplicável:",
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "confirmação da existência de tratamento;",
    ]),
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "acesso aos dados;",
    ]),
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "correção de dados incompletos, inexatos ou desatualizados;",
    ]),
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a legislação;",
    ]),
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "portabilidade, quando aplicável e observadas as condições legais e técnicas pertinentes;",
    ]),
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "informação sobre compartilhamentos, nos termos aplicáveis;",
    ]),
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "informação sobre a possibilidade de não fornecer consentimento e suas consequências, quando o tratamento depender de consentimento;",
    ]),
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "revogação do consentimento, quando essa for a base aplicável; e",
    ]),
  },
  {
    type: "ul",
    style: "alpha",
    items: Object.freeze([
      "demais direitos previstos na legislação aplicável.",
    ]),
  },
  {
    type: "p",
    text: "As solicitações podem ser encaminhadas para:",
  },
  {
    type: "p",
    text: "privacidade@justwebsites.com.br",
  },
  {
    type: "p",
    text: "A JUST poderá solicitar informações razoavelmente necessárias para confirmar a identidade do solicitante e proteger os dados contra acesso indevido.",
  },
  {
    type: "p",
    text: "Determinadas solicitações poderão estar sujeitas a limitações previstas em lei ou à necessidade de manutenção de dados para cumprimento de obrigações ou exercício regular de direitos.",
  },
  { type: "h2", text: "13. Solicitações relativas a dados tratados por um Cliente da JUST" },
  {
    type: "p",
    text: "Em determinadas situações, a JUST trata dados pessoais como parte da infraestrutura disponibilizada a um Cliente, enquanto esse Cliente mantém a relação direta com o titular e determina as finalidades do tratamento.",
  },
  {
    type: "p",
    text: "Por exemplo, isso pode ocorrer quando uma pessoa fornece seus dados a uma empresa que utiliza a JUST para administrar clientes, leads, contatos, pagamentos ou outras atividades.",
  },
  {
    type: "p",
    text: "Nesses casos, determinadas solicitações relacionadas aos dados devem ser dirigidas diretamente à empresa ou organização que os coletou.",
  },
  {
    type: "p",
    text: "Quando apropriado, a JUST poderá orientar o titular a entrar em contato com o Cliente responsável ou colaborar com o Cliente no atendimento da solicitação, conforme aplicável.",
  },
  { type: "h2", text: "14. Crianças e adolescentes" },
  {
    type: "p",
    text: "A JUST é uma plataforma destinada à utilização no contexto de atividades profissionais e empresariais e não é concebida como serviço dirigido especificamente a crianças.",
  },
  {
    type: "p",
    text: "Entretanto, dependendo da atividade de determinado Cliente, dados relacionados a crianças ou adolescentes podem eventualmente ser tratados por meio das funcionalidades utilizadas por esse Cliente.",
  },
  {
    type: "p",
    text: "Nessas situações, cabe ao Cliente assegurar que a coleta e o tratamento desses dados sejam realizados de acordo com a legislação aplicável, inclusive quanto às exigências específicas relacionadas a crianças e adolescentes.",
  },
  {
    type: "p",
    text: "Quando a JUST tratar esses dados para prestar os serviços contratados pelo Cliente, o tratamento ocorrerá no contexto das instruções e finalidades determinadas pelo Cliente, ressalvadas as obrigações próprias da JUST previstas em lei.",
  },
  { type: "h2", text: "15. Sites, integrações e serviços de terceiros" },
  {
    type: "p",
    text: "A plataforma poderá permitir acesso, conexão ou integração com sites e serviços mantidos por terceiros.",
  },
  {
    type: "p",
    text: "A utilização desses serviços poderá estar sujeita aos respectivos termos e políticas de privacidade.",
  },
  {
    type: "p",
    text: "A JUST não controla as práticas independentes de tratamento de dados adotadas por terceiros em seus próprios ambientes.",
  },
  {
    type: "p",
    text: "Recomendamos que o Cliente e os Usuários consultem as políticas aplicáveis aos serviços externos que decidirem utilizar ou conectar à JUST.",
  },
  { type: "h2", text: "16. Comunicações" },
  {
    type: "p",
    text: "A JUST poderá utilizar dados de contato para enviar comunicações necessárias à prestação dos serviços, incluindo mensagens:",
  },
  {
    type: "ul",
    style: "disc",
    items: Object.freeze([
      "administrativas;",
      "operacionais;",
      "relacionadas à conta;",
      "de segurança;",
      "de suporte;",
      "de cobrança; e",
      "sobre alterações relevantes dos serviços ou da relação contratual.",
    ]),
  },
  {
    type: "p",
    text: "Essas comunicações necessárias à execução e administração do serviço não dependem de inscrição em comunicações promocionais.",
  },
  {
    type: "p",
    text: "Eventuais comunicações promocionais, quando realizadas, observarão os requisitos aplicáveis e os mecanismos de oposição ou descadastramento pertinentes.",
  },
  { type: "h2", text: "17. Alterações desta Política" },
  {
    type: "p",
    text: "A JUST poderá atualizar esta Política para refletir alterações legais, regulatórias, técnicas, operacionais ou relacionadas aos serviços oferecidos.",
  },
  {
    type: "p",
    text: "A versão vigente será disponibilizada nos canais oficiais da JUST, com identificação da versão e da respectiva data de vigência.",
  },
  {
    type: "p",
    text: "Quando uma alteração for relevante, a JUST poderá comunicá-la por meio razoável, como pela plataforma ou pelo e-mail cadastrado.",
  },
  {
    type: "p",
    text: "Quando a legislação exigir manifestação específica do titular para determinado tratamento, será adotado o procedimento correspondente.",
  },
  { type: "h2", text: "18. Contato" },
  {
    type: "p",
    text: "Para dúvidas, solicitações ou exercício de direitos relacionados à privacidade e proteção de dados:",
  },
  {
    type: "p",
    text: "privacidade@justwebsites.com.br",
  },
  {
    type: "p",
    text: "SHEFA MARKETING LTDA.",
  },
  {
    type: "p",
    text: "CNPJ 48.591.474/0001-81",
  },
  {
    type: "p",
    text: "Operadora da plataforma JUST.",
  },
])

export const justPrivacyPolicyV1 = Object.freeze({
  slug: "privacidade",
  title: "Política de Privacidade da JUST",
  version: "1.0",
  effectiveDateLabel: "23 de setembro de 2026",
  document: JUST_PRIVACY_V1_DOCUMENT,
})

