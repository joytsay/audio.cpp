# Prerecorded greetings

- `greeting1.wav`: lingCL voice, selected by `#1`.
- `greeting2.wav`: WangSG voice, selected by `#2`.

Both say: 歡迎來電期偶科技，請問我可以怎麼服務您？

Prepared once with the existing ZipVoice-Distill model and the repository's
`examples/ivrTTS/voices/lingCLvocals.wav`, `wangSG9s.wav` and `prompt_text`
references. Files are mono PCM16 WAV at 24 kHz. The worker resamples to the
negotiated PCMU rate during playback. It never calls TTS during registration,
calls, or between calls. Replace either WAV with another mono PCM16 recording
to change a greeting; restart the worker to reload it.
