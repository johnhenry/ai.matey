```html
<html>
  <head>
    <title>MediaPipe Demo</title>
    <script type="module">
      import {FilesetResolver, LlmInference} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai';
      import FileProxyCache from 'https://cdn.jsdelivr.net/gh/jasonmayes/web-ai-model-proxy-cache@main/FileProxyCache.min.js';
      import MediaPipe from '../mediapipe/index.mjs'

      // New api takes in
      const ai = new MediaPipe({model:'https://storage.googleapis.com/jmstore/WebAIDemos/models/Gemma2/gemma2-2b-it-gpu-int8.bin'});

      const model = await ai.languageModel.create();
      await model.initialize({
        fileProgressCallback:console.log,
        FilesetResolver,
        LlmInference,
        FileProxyCache})
      console.log("asking who...")
      console.log(await model.prompt("who are you?"))
    </script>
</html>
```





