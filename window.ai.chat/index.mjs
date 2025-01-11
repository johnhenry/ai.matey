const { log } = console;

const countTokens = (text) => {
    if (!text) return 0;
    
    // Split on whitespace and punctuation
    const words = text.trim().split(/[\s\p{P}]+/u).filter(Boolean);
    
    // Count subwords based on common patterns
    let tokenCount = 0;
    for (const word of words) {
      // Handle common patterns that might split into multiple tokens:
      // 1. CamelCase or PascalCase: thisIsAWord -> [this, Is, A, Word]
      // 2. snake_case or kebab-case: this_is_a_word -> [this, is, a, word]
      // 3. Numbers and special characters
      
      const subwords = word
        // Split on camelCase and PascalCase
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        // Split on snake_case and kebab-case
        .replace(/[_-]/g, ' ')
        // Split numbers from text
        .replace(/(\d+)/g, ' $1 ')
        .trim()
        .split(/\s+/);
      
      tokenCount += subwords.length;
      
      // Add extra tokens for very long words (assuming they might be split further)
      for (const subword of subwords) {
        if (subword.length > 12) {
          tokenCount += Math.floor(subword.length / 12);
        }
      }
    }

    return Math.max(1, tokenCount);
  }


const chat = async ({messages, stream, ...options}) =>{
    const initialPrompts = [...messages];
    let systemPrompt;
    const systemPromptIndex = initialPrompts.findIndex((message) => message.role === "system");
    if(systemPromptIndex !== -1) {
        systemPrompt = initialPrompts[systemPromptIndex].content;
        initialPrompts.splice(systemPromptIndex, 1);
    }
    const lastMessage = initialPrompts.pop();
    if (!lastMessage || lastMessage.role !== 'user') {
        throw new Error('Last message must be from user');
    }

    const prompt = lastMessage.content;

    // TODO: should we handle the error?
    if('topK' in options && !('temperature' in options)){
        delete options.topK;
    }
    if('temperature' in options && !('topK' in options)){
        delete options.temperature;
    }
    // find system prompt in messsages
    // Set conversation history to all messages except the last one
    const initObject = {...options, initialPrompts, systemPrompt, monitor(m) {
        m.addEventListener("downloadprogress", (e) => {
          log(
            `Window AI: Downloaded ${e.loaded} of ${e.total} bytes.`
          );
        });
      }}
    const model = await window.ai.languageModel.create(initObject);
    // Generate a unique ID for this conversation
    const id = `${Math.random().toString(36).slice(2)}`;
    const created = Math.floor(Date.now() / 1000);
    try{
        if (stream) {
            const streamer = await model.promptStreaming(prompt, options)
            // Transform the stream to emit properly formatted chunks
            return (async function* (){
            for await (const chunk of streamer) {
                yield {
                id,
                created,
                model: "window.ai",
                endpoint: "window.ai",
                object: "chat.completion.chunk",
                system_fingerprint: null,
                choices: [{
                    finish_reason: null,
                    index: 0,
                    delta: {
                    content: chunk,
                    role: "assistant",
                    function_call: null,
                    tool_calls: null,
                    audio: null
                    },
                    logprobs: null
                }]
                };
            }
    
            }).call(this);
        } else {
            const content = await model.prompt(lastMessage.content, options);
            // Format the response according to the example
            return {
            id,
            created,
            model: "window.ai",
            endpoint: "window.ai",
            object: "chat.completion",
            system_fingerprint: null,
            choices: [{
                finish_reason: "stop",
                index: 0,
                message: {
                content,
                role: "assistant",
                tool_calls: null,
                function_call: null
                }
            }],
            usage: {
                completion_tokens: countTokens(content),
                prompt_tokens: countTokens(lastMessage.content),
                total_tokens: countTokens(content) + countTokens(lastMessage.content),
                completion_tokens_details: null,
                prompt_tokens_details: {
                audio_tokens: null,
                cached_tokens: 0
                },
                cache_creation_input_tokens: 0,
                cache_read_input_tokens: 0
            }
            };
        }
    }catch(e){

    }finally{
        await model.destroy();
    }
}

export default chat
export {chat}