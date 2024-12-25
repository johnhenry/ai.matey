
Generate text using the Gemini API
==================================

REST

The Gemini API can generate text output when provided text, images, video, and audio as input.

This guide shows you how to generate text using the [`generateContent`](/api/rest/v1/models/generateContent) and [`streamGenerateContent`](/api/rest/v1/models/streamGenerateContent) methods. To learn about working with Gemini's vision and audio capabilities, refer to the [Vision](/gemini-api/docs/vision) and [Audio](/gemini-api/docs/audio) guides.

Before you begin: Set up your project and API key
-------------------------------------------------

Before calling the Gemini API, you need to set up your project and configure your API key.

**Expand to view how to set up your project and API key**

**Tip:** For complete setup instructions, see the [Gemini API quickstart](/gemini-api/docs/quickstart).

### Get and secure your API key

You need an API key to call the Gemini API. If you don't already have one, create a key in Google AI Studio.

[Get an API key](https://aistudio.google.com/app/apikey)

It's strongly recommended that you do _not_ check an API key into your version control system.

This tutorial assumes that you're accessing your API key as an environment variable.

Generate text from text-only input
----------------------------------

The simplest way to generate text using the Gemini API is to provide the model with a single text-only input, as shown in this example:

curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$GOOGLE_API_KEY" \
        -H 'Content-Type: application/json' \
        -X POST \
        -d '{
          "contents": [{
            "parts":[{"text": "Write a story about a magic backpack."}]
            }]
           }' 2> /dev/nulltext_generation.sh

In this case, the prompt ("Write a story about a magic backpack") doesn't include any output examples, system instructions, or formatting information. It's a [zero-shot](/gemini-api/docs/models/generative-models#zero-shot-prompts) approach. For some use cases, a [one-shot](/gemini-api/docs/models/generative-models#one-shot-prompts) or [few-shot](/gemini-api/docs/models/generative-models#few-shot-prompts) prompt might produce output that's more aligned with user expectations. In some cases, you might also want to provide [system instructions](/gemini-api/docs/system-instructions) to help the model understand the task or follow specific guidelines.

Generate text from text-and-image input
---------------------------------------

The Gemini API supports multimodal inputs that combine text with media files. The following example shows how to generate text from text-and-image input:

# Use a temporary file to hold the base64 encoded image data
    TEMP_B64=$(mktemp)
    trap 'rm -f "$TEMP_B64"' EXIT
    base64 $B64FLAGS $IMG_PATH > "$TEMP_B64"
    
    # Use a temporary file to hold the JSON payload
    TEMP_JSON=$(mktemp)
    trap 'rm -f "$TEMP_JSON"' EXIT
    
    cat > "$TEMP_JSON" << EOF
    {
      "contents": [{
        "parts":[
          {"text": "Tell me about this instrument"},
          {
            "inline_data": {
              "mime_type":"image/jpeg",
              "data": "$(cat "$TEMP_B64")"
            }
          }
        ]
      }]
    }
    EOF
    
    curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$GOOGLE_API_KEY" \
        -H 'Content-Type: application/json' \
        -X POST \
        -d "@$TEMP_JSON" 2> /dev/nulltext_generation.sh

As with text-only prompting, multimodal prompting can involve various approaches and refinements. Depending on the output from this example, you might want to add steps to the prompt or be more specific in your instructions. To learn more, see [File prompting strategies](/gemini-api/docs/file-prompting-strategies).

Generate a text stream
----------------------

By default, the model returns a response after completing the entire text generation process. You can achieve faster interactions by not waiting for the entire result, and instead use streaming to handle partial results.

The following example shows how to implement streaming using the [`streamGenerateContent`](/api/rest/v1/models/streamGenerateContent) method to generate text from a text-only input prompt.

curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse&key=${GOOGLE_API_KEY}" \
            -H 'Content-Type: application/json' \
            --no-buffer \
            -d '{ "contents":[{"parts":[{"text": "Write a story about a magic backpack."}]}]}'text_generation.sh

Build an interactive chat
-------------------------

You can use the Gemini API to build interactive chat experiences for your users. Using the chat feature of the API lets you collect multiple rounds of questions and responses, allowing users to step incrementally toward answers or get help with multipart problems. This feature is ideal for applications that require ongoing communication, such as chatbots, interactive tutors, or customer support assistants.

The following code example shows a basic chat implementation:

curl https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$GOOGLE_API_KEY \
        -H 'Content-Type: application/json' \
        -X POST \
        -d '{
          "contents": [
            {"role":"user",
             "parts":[{
               "text": "Hello"}]},
            {"role": "model",
             "parts":[{
               "text": "Great to meet you. What would you like to know?"}]},
            {"role":"user",
             "parts":[{
               "text": "I have two dogs in my house. How many paws are in my house?"}]},
          ]
        }' 2> /dev/null | grep "text"chat.sh

Enable chat streaming
---------------------

You can also use streaming with chat, as shown in the following example:

curl https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse&key=$GOOGLE_API_KEY \
        -H 'Content-Type: application/json' \
        -X POST \
        -d '{
          "contents": [
            {"role":"user",
             "parts":[{
               "text": "Hello"}]},
            {"role": "model",
             "parts":[{
               "text": "Great to meet you. What would you like to know?"}]},
            {"role":"user",
             "parts":[{
               "text": "I have two dogs in my house. How many paws are in my house?"}]},
          ]
        }' 2> /dev/null | grep "text"chat.sh

Configure text generation
-------------------------

Every prompt you send to the model includes [parameters](/gemini-api/docs/models/generative-models#model-parameters) that control how the model generates responses. You can use [`GenerationConfig`](/api/rest/v1/GenerationConfig) to configure these parameters. If you don't configure the parameters, the model uses default options, which can vary by model.

The following example shows how to configure several of the available options.

curl https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$GOOGLE_API_KEY \
        -H 'Content-Type: application/json' \
        -X POST \
        -d '{
            "contents": [{
                "parts":[
                    {"text": "Write a story about a magic backpack."}
                ]
            }],
            "safetySettings": [
                {
                    "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                    "threshold": "BLOCK_ONLY_HIGH"
                }
            ],
            "generationConfig": {
                "stopSequences": [
                    "Title"
                ],
                "temperature": 1.0,
                "maxOutputTokens": 800,
                "topP": 0.8,
                "topK": 10
            }
        }'  2> /dev/null | grep "text"configure_model_parameters.sh

`stopSequences` specifies the set of character sequences (up to 5) that will stop output generation. If specified, the API will stop at the first appearance of a `stop_sequence`. The stop sequence won't be included as part of the response.

`temperature` controls the randomness of the output. Use higher values for more creative responses, and lower values for more deterministic responses. Values can range from \[0.0, 2.0\].

`maxOutputTokens` sets the maximum number of tokens to include in a candidate.

`topP` changes how the model selects tokens for output. Tokens are selected from the most to least probable until the sum of their probabilities equals the `topP` value. The default `topP` value is 0.95.

`topK` changes how the model selects tokens for output. A `topK` of 1 means the selected token is the most probable among all the tokens in the model's vocabulary, while a `topK` of 3 means that the next token is selected from among the 3 most probable using the temperature. Tokens are further filtered based on `topP` with the final token selected using temperature sampling.

What's next
-----------

Now that you have explored the basics of the Gemini API, you might want to try:

*   [Vision understanding](/gemini-api/docs/vision): Learn how to use Gemini's native vision understanding to process images and videos.
*   [System instructions](/gemini-api/docs/system-instructions): System instructions let you steer the behavior of the model based on your specific needs and use cases.
*   [Audio understanding](/gemini-api/docs/audio): Learn how to use Gemini's native audio understanding to process audio files.

Send feedback

Except as otherwise noted, the content of this page is licensed under the [Creative Commons Attribution 4.0 License](https://creativecommons.org/licenses/by/4.0/), and code samples are licensed under the [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0). For details, see the [Google Developers Site Policies](https://developers.google.com/site-policies). Java is a registered trademark of Oracle and/or its affiliates.

Last updated 2024-12-11 UTC.

*   [Terms](//policies.google.com/terms)
*   [Privacy](//policies.google.com/privacy)
*   [Manage cookies](#)

*   English
*   Deutsch
*   Español – América Latina
*   Français
*   Indonesia
*   Italiano
*   Polski
*   Português – Brasil
*   Shqip
*   Tiếng Việt
*   Türkçe
*   Русский
*   עברית
*   العربيّة
*   فارسی
*   हिंदी
*   বাংলা
*   ภาษาไทย
*   中文 – 简体
*   中文 – 繁體
*   日本語
*   한국어

\[\] {&#34;at&#34;: &#34;True&#34;, &#34;ga4&#34;: \[\], &#34;ga4p&#34;: \[\], &#34;gtm&#34;: \[{&#34;id&#34;: &#34;GTM-TC2MQKS8&#34;, &#34;purpose&#34;: 0}\], &#34;parameters&#34;: {&#34;internalUser&#34;: &#34;False&#34;, &#34;language&#34;: {&#34;machineTranslated&#34;: &#34;False&#34;, &#34;requested&#34;: &#34;en&#34;, &#34;served&#34;: &#34;en&#34;}, &#34;pageType&#34;: &#34;article&#34;, &#34;projectName&#34;: &#34;Gemini API&#34;, &#34;signedIn&#34;: &#34;False&#34;, &#34;tenant&#34;: &#34;googledevai&#34;, &#34;recommendations&#34;: {&#34;sourcePage&#34;: &#34;&#34;, &#34;sourceType&#34;: 0, &#34;sourceRank&#34;: 0, &#34;sourceIdenticalDescriptions&#34;: 0, &#34;sourceTitleWords&#34;: 0, &#34;sourceDescriptionWords&#34;: 0, &#34;experiment&#34;: &#34;&#34;}, &#34;experiment&#34;: {&#34;ids&#34;: &#34;&#34;}}} (function(d,e,v,s,i,t,E){d\['GoogleDevelopersObject'\]=i; t=e.createElement(v);t.async=1;t.src=s;E=e.getElementsByTagName(v)\[0\]; E.parentNode.insertBefore(t,E);})(window, document, 'script', 'https://www.gstatic.com/devrel-devsite/prod/v5ab6fd0ad9c02b131b4d387b5751ac2c3616478c6dd65b5e931f0805efa1009c/googledevai/js/app\_loader.js', '\[59,"en",null,"/js/devsite\_app\_module.js","https://www.gstatic.com/devrel-devsite/prod/v5ab6fd0ad9c02b131b4d387b5751ac2c3616478c6dd65b5e931f0805efa1009c","https://www.gstatic.com/devrel-devsite/prod/v5ab6fd0ad9c02b131b4d387b5751ac2c3616478c6dd65b5e931f0805efa1009c/googledevai","https://googledevai-dot-devsite-v2-prod-3p.appspot.com",null,null,\["/\_pwa/googledevai/manifest.json","https://www.gstatic.com/devrel-devsite/prod/v5ab6fd0ad9c02b131b4d387b5751ac2c3616478c6dd65b5e931f0805efa1009c/images/video-placeholder.svg","https://www.gstatic.com/devrel-devsite/prod/v5ab6fd0ad9c02b131b4d387b5751ac2c3616478c6dd65b5e931f0805efa1009c/googledevai/images/favicon-new.png","/\_static/googledevai/images/lockup-new.svg","https://fonts.googleapis.com/css?family=Google+Sans:400,500|Roboto:400,400italic,500,500italic,700,700italic|Roboto+Mono:400,500,700&display=swap"\],1,null,\[1,6,8,12,14,17,21,25,50,52,63,70,75,76,80,87,91,92,93,97,98,100,101,102,103,104,105,107,108,109,110,112,113,116,117,118,120,122,124,125,126,127,129,130,131,132,133,134,135,136,138,140,141,147,148,149,151,152,156,157,158,159,161,163,164,168,169,170,179,180,182,183,186,191,193,196\],"AIzaSyCNm9YxQumEXwGJgTDjxoxXK6m1F-9720Q","AIzaSyCc76DZePGtoyUjqKrLdsMGk\_ry7sljLbY","ai.google.dev","AIzaSyB9bqgQ2t11WJsOX8qNsCQ6U-w91mmqF-I","AIzaSyAdYnStPdzjcJJtQ0mvIaeaMKj7\_t6J\_Fg",null,null,null,\["Cloud\_\_enable\_cloudx\_experiment\_ids","Cloud\_\_enable\_cloud\_facet\_chat","Profiles\_\_enable\_developer\_profiles\_callout","Cloud\_\_enable\_llm\_concierge\_chat","Concierge\_\_enable\_pushui","MiscFeatureFlags\_\_enable\_project\_variables","MiscFeatureFlags\_\_developers\_footer\_image","BookNav\_\_enable\_tenant\_cache\_key","EngEduTelemetry\_\_enable\_engedu\_telemetry","MiscFeatureFlags\_\_enable\_firebase\_utm","TpcFeatures\_\_enable\_unmirrored\_page\_left\_nav","OnSwitch\_\_enable","Experiments\_\_reqs\_query\_experiments","MiscFeatureFlags\_\_enable\_view\_transitions","Cloud\_\_enable\_free\_trial\_server\_call","MiscFeatureFlags\_\_enable\_explain\_this\_code","Cloud\_\_enable\_cloud\_shell","Profiles\_\_enable\_completecodelab\_endpoint","DevPro\_\_enable\_cloud\_innovators\_plus","Search\_\_enable\_ai\_eligibility\_checks","Analytics\_\_enable\_clearcut\_logging","MiscFeatureFlags\_\_developers\_footer\_dark\_image","Profiles\_\_enable\_join\_program\_group\_endpoint","DevPro\_\_enable\_developer\_subscriptions","MiscFeatureFlags\_\_enable\_variable\_operator","CloudShell\_\_cloud\_code\_overflow\_menu","Profiles\_\_enable\_awarding\_url","Cloud\_\_enable\_legacy\_calculator\_redirect","Profiles\_\_enable\_recognition\_badges","Profiles\_\_enable\_page\_saving","CloudShell\_\_cloud\_shell\_button","Cloud\_\_enable\_cloud\_shell\_fte\_user\_flow","Profiles\_\_enable\_public\_developer\_profiles","Search\_\_enable\_suggestions\_from\_borg","Profiles\_\_enable\_release\_notes\_notifications","Profiles\_\_enable\_complete\_playlist\_endpoint","Cloud\_\_enable\_cloud\_dlp\_service","Profiles\_\_enable\_dashboard\_curated\_recommendations","Cloud\_\_enable\_cloudx\_ping","TpcFeatures\_\_enable\_mirror\_tenant\_redirects","Search\_\_enable\_page\_map","Profiles\_\_enable\_profile\_collections","Search\_\_enable\_dynamic\_content\_confidential\_banner","Profiles\_\_require\_profile\_eligibility\_for\_signin","MiscFeatureFlags\_\_emergency\_css"\],null,null,"AIzaSyA58TaKli1DculwmAmbpzLVGuWc8eCQgQc","https://developerscontentserving-pa.googleapis.com","AIzaSyDWBU60w0P9hEkr29kkksYs8Z7gvZ8u\_wc","https://developerscontentsearch-pa.googleapis.com",2,4,null,"https://developerprofiles-pa.googleapis.com",\[59,"googledevai","Google AI for Developers","ai.google.dev",null,"googledevai-dot-devsite-v2-prod-3p.appspot.com",null,null,\[null,1,null,null,null,null,null,null,null,null,null,\[1\],null,null,null,null,null,null,\[1\],null,null,null,null,\[1\],\[1,1,null,1,1\]\],null,\[73,null,null,null,null,null,"/images/lockup-new.svg","/images/touchicon-180-new.png",null,null,null,null,1,1,null,null,null,null,null,null,null,1,null,null,null,"/images/lockup-dark-theme-new.svg",\[\]\],\[\],null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,\[44,2,4,6,7,12,14,15,17,18,20,21,22,23,28,29,32,37,39,40,43\],null,\[\[\],\[1,1\]\],\[\[null,null,null,null,null,\["GTM-TC2MQKS8"\],null,null,null,null,null,\[\["GTM-TC2MQKS8",1\]\],1\]\],null,4\]\]')