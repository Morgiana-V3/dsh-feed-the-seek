// Retain visible replies and tool calls, without request headers or model reasoning.
module.exports = function sessionEvidence(entries) {
  return entries.map(({ session, event }) => {
    const evidence = { type: event.type, seq: event.seq, time: event.time }
    if (event.type === 'assistant/message') {
      evidence.data = {
        message: {
          content: (event.data?.message?.content || []).filter((block) =>
            ['text', 'tool-call'].includes(block.type),
          ),
        },
      }
    }
    return { session, event: evidence }
  })
}
