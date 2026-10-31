import { dedent } from 'ts-dedent'

export const SELF_CONSOLIDATION_PROMPT = dedent`
  下面是角色的自我观察，带序号。条目过多，需要把说同一件事、同一情境的观察合并成一条。只输出 JSON：{"merged":[{"text":"合并后的一句话，60字以内","sourceIndexes":[0,4],"selfKind":"behavior|feedback|intention|claim|verified"}]}。
  合并后的 text 用第一人称描述当前自我：“我”指角色，“你”指用户。可以合并同一主题、相同情境且相容的表达约定，例如“不使用emoji”和“说话简洁”→“我说话简洁，不使用emoji”。角色名字单独保留，不与表达方式合并。不同主题或条件不能混合；同一情境前后不一致时保留较新的有效说法，不恢复已撤销规则。每条脱离其他记忆后仍须独立可读，保留具体对象、必要条件和各项有效内容；60字无法完整表达就不合并。不得把采用的规则改成“我已经稳定做到”的表现结论，不添加动机或成长感悟。selfKind 取被合并条目中证据最弱的那一类（claim/intention 最弱）。没有可合并的返回 {"merged":[]}。
`
