import { Proposal } from '../memory/index.js';
/**
 * Returns both the validated proposal and the raw object. The raw form matters: an UPDATE must
 * keep fields the model did not send, and that is only visible before schema defaults fill them.
 */
function parseProposal(output) {
    const raw = JSON.parse(output
        .trim()
        .replace(/^```(?:json)?\s*/, '')
        .replace(/\s*```$/, ''));
    return { proposal: Proposal.parse(raw), raw };
}
export async function generateProposal(generate, system, input, signal, callTimeoutMs) {
    const callSignal = () => callTimeoutMs ? AbortSignal.any([signal, AbortSignal.timeout(callTimeoutMs)]) : signal;
    const output = await generate(system, JSON.stringify(input), callSignal());
    try {
        return { ...parseProposal(output), repaired: false };
    }
    catch (error) {
        signal.throwIfAborted();
        const correction = String(error).slice(0, 1600);
        const repairedOutput = await generate(system +
            '\n上一次输出未通过 JSON 结构校验。根据 formatCorrection 修正格式，重新判断原始事件，只输出符合约定的 JSON。不要添加约定以外的字段；没有值得记录的变化可以返回 {"operations":[],"state":null}。', JSON.stringify({ ...input, formatCorrection: correction }), callSignal());
        return { ...parseProposal(repairedOutput), repaired: true };
    }
}
//# sourceMappingURL=proposal.js.map