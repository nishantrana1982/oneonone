import OpenAI from 'openai'
import { getSettings } from './settings'

// Create OpenAI client with settings from database
async function getOpenAIClient(): Promise<OpenAI> {
  const settings = await getSettings()
  
  if (!settings.openaiApiKey) {
    throw new Error('OpenAI API key not configured. Please configure it in Admin > Settings.')
  }
  
  return new OpenAI({
    apiKey: settings.openaiApiKey,
  })
}

// Get the model from settings
async function getModels(): Promise<{ gptModel: string; whisperModel: string }> {
  const settings = await getSettings()
  return {
    gptModel: settings.openaiModel || 'gpt-4o',
    whisperModel: settings.whisperModel || 'whisper-1',
  }
}

export interface TranscriptionResult {
  text: string
  language: string
  duration: number
}

export interface AnalysisResult {
  summary: string
  keyPoints: string[]
  suggestedTodos: Array<{
    title: string
    description: string
    assignTo: 'employee' | 'reporter'
    priority: 'HIGH' | 'MEDIUM' | 'LOW'
  }>
  sentiment: {
    score: number // -1 to 1
    label: 'positive' | 'neutral' | 'negative'
    employeeMood: string
    reporterEngagement: string
    overallTone: string
  }
  qualityScore: number // 1-100
  qualityDetails: {
    clarity: number // 1-10
    actionability: number // 1-10
    engagement: number // 1-10
    goalAlignment: number // 1-10
    followUp: number // 1-10
    overallFeedback: string
  }
  commonThemes: string[]
}

export async function transcribeAudio(audioBuffer: Buffer, filename: string, language?: string): Promise<TranscriptionResult> {
  try {
    const openai = await getOpenAIClient()
    const models = await getModels()
    
    console.log(`[OpenAI] Starting transcription with model: ${models.whisperModel}, language: ${language || 'auto-detect'}`)
    console.log(`[OpenAI] Audio buffer size: ${audioBuffer.length} bytes`)
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3586127d-afb9-4fd9-8176-bb1ac89ea454',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'openai.ts:66',message:'Transcription started',data:{bufferSize:audioBuffer.length,firstBytes:audioBuffer.slice(0,16).toString('hex'),model:models.whisperModel,language},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B,D'})}).catch(()=>{});
    // #endregion
    
    // Create a Blob-like object that OpenAI SDK can handle in Node.js
    // The SDK accepts: File, Blob, or Uploadable (which includes Buffer with name)
    const fs = await import('fs')
    const path = await import('path')
    const os = await import('os')
    
    // Write buffer to temp file and create a readable stream
    const tempDir = os.tmpdir()
    const tempFilePath = path.join(tempDir, `recording_${Date.now()}.webm`)
    await fs.promises.writeFile(tempFilePath, audioBuffer)
    
    // Verify file was written correctly
    const stats = await fs.promises.stat(tempFilePath)
    const verifyBuffer = await fs.promises.readFile(tempFilePath)
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3586127d-afb9-4fd9-8176-bb1ac89ea454',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'openai.ts:84',message:'Temp file written',data:{tempFilePath,fileSize:stats.size,verifySize:verifyBuffer.length,verifyFirstBytes:verifyBuffer.slice(0,16).toString('hex'),matchesOriginal:Buffer.compare(audioBuffer,verifyBuffer)===0},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    console.log(`[OpenAI] Wrote temp file: ${tempFilePath} (${audioBuffer.length} bytes)`)
    
    // Create a readable stream from the file
    const fileStream = fs.createReadStream(tempFilePath)

    // Build transcription options - include language if specified
    const transcriptionOptions: any = {
      file: fileStream,
      model: models.whisperModel,
      response_format: 'verbose_json',
    }
    
    // If language is specified, pass it to Whisper to improve accuracy
    // ISO-639-1 codes: en=English, hi=Hindi, gu=Gujarati, mr=Marathi, etc.
    if (language && language !== 'auto') {
      transcriptionOptions.language = language
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3586127d-afb9-4fd9-8176-bb1ac89ea454',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'openai.ts:106',message:'Calling OpenAI API',data:{model:transcriptionOptions.model,language:transcriptionOptions.language,responseFormat:transcriptionOptions.response_format},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B,E'})}).catch(()=>{});
    // #endregion

    const response = await openai.audio.transcriptions.create(transcriptionOptions) as any

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3586127d-afb9-4fd9-8176-bb1ac89ea454',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'openai.ts:113',message:'OpenAI response received',data:{textLength:response.text?.length||0,language:response.language,duration:response.duration},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    console.log(`[OpenAI] Transcription successful. Text length: ${response.text?.length || 0}`)
    
    // Clean up temp file
    try {
      await fs.promises.unlink(tempFilePath)
    } catch (e) {
      // Ignore cleanup errors
    }

    // verbose_json format returns language and duration, but TypeScript types don't include them
    return {
      text: response.text,
      language: response.language || language || 'en',
      duration: response.duration || 0,
    }
  } catch (error: any) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3586127d-afb9-4fd9-8176-bb1ac89ea454',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'openai.ts:134',message:'Transcription error',data:{errorMessage:error.message,errorStatus:error.status,errorCode:error.code,errorType:error.type,fullError:JSON.stringify(error,Object.getOwnPropertyNames(error))},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B,D,E'})}).catch(()=>{});
    // #endregion
    
    console.error('[OpenAI] Transcription error:', error)
    console.error('[OpenAI] Error details:', JSON.stringify({
      message: error.message,
      status: error.status,
      code: error.code,
      type: error.type,
    }))
    
    // Provide helpful error messages
    if (error.message?.includes('API key')) {
      throw new Error('OpenAI API key is invalid or not configured. Please check Admin > Settings.')
    }
    if (error.status === 401) {
      throw new Error('OpenAI API authentication failed. Please verify your API key in Admin > Settings.')
    }
    if (error.status === 429) {
      throw new Error('OpenAI rate limit exceeded. Please try again later.')
    }
    if (error.status === 400) {
      // Include more details in the error message
      const details = error.message || error.error?.message || 'Unknown error'
      throw new Error(`Invalid audio file: ${details}`)
    }
    
    throw error
  }
}

export async function analyzeTranscript(
  transcript: string,
  employeeName: string,
  reporterName: string
): Promise<AnalysisResult> {
  const systemPrompt = `You are an expert at analyzing one-on-one meeting transcripts. 
Your task is to extract insights, action items, and assess meeting quality.
The transcript may be in English, Hindi, or Gujarati. Provide analysis in English.

Employee: ${employeeName}
Reporter/Manager: ${reporterName}

Analyze the transcript and provide:
1. A concise summary (2-3 sentences)
2. Key points discussed (bullet points)
3. Suggested action items/todos with assignee and priority
4. Sentiment analysis
5. Meeting quality score and detailed breakdown

Be thorough but concise. Focus on actionable insights.`

  const userPrompt = `Analyze this one-on-one meeting transcript:

---
${transcript}
---

Provide your analysis in the following JSON format:
{
  "summary": "Brief 2-3 sentence summary",
  "keyPoints": ["point 1", "point 2", ...],
  "suggestedTodos": [
    {
      "title": "Task title",
      "description": "Brief description",
      "assignTo": "employee" or "reporter",
      "priority": "HIGH", "MEDIUM", or "LOW"
    }
  ],
  "sentiment": {
    "score": number between -1 and 1,
    "label": "positive", "neutral", or "negative",
    "employeeMood": "description of employee's mood/attitude",
    "reporterEngagement": "description of reporter's engagement",
    "overallTone": "description of overall meeting tone"
  },
  "qualityScore": number between 1-100,
  "qualityDetails": {
    "clarity": number 1-10,
    "actionability": number 1-10,
    "engagement": number 1-10,
    "goalAlignment": number 1-10,
    "followUp": number 1-10,
    "overallFeedback": "brief feedback on meeting quality"
  },
  "commonThemes": ["theme1", "theme2", ...]
}

Only respond with valid JSON, no additional text.`

  const openai = await getOpenAIClient()
  const models = await getModels()

  const response = await openai.chat.completions.create({
    model: models.gptModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  })

  const content = response.choices[0].message.content
  if (!content) {
    throw new Error('No response from OpenAI')
  }

  return JSON.parse(content) as AnalysisResult
}

export async function searchTranscripts(
  transcripts: Array<{ id: string; text: string; meetingId: string }>,
  query: string
): Promise<Array<{ id: string; meetingId: string; relevance: number; snippet: string }>> {
  const systemPrompt = `You are a search assistant. Given a search query and a list of meeting transcripts, 
find the most relevant transcripts and return their IDs with relevance scores and relevant snippets.
Transcripts may be in English, Hindi, or Gujarati. Search across all languages.`

  const userPrompt = `Search query: "${query}"

Transcripts:
${transcripts.map((t, i) => `[${i}] ID: ${t.id}, Meeting: ${t.meetingId}\n${t.text.slice(0, 500)}...`).join('\n\n')}

Return results as JSON array:
[
  {
    "index": number,
    "relevance": number 0-100,
    "snippet": "relevant excerpt from transcript"
  }
]
Only include transcripts with relevance > 30. Sort by relevance descending.`

  const openai = await getOpenAIClient()

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  })

  const content = response.choices[0].message.content
  if (!content) {
    return []
  }

  const parsed = JSON.parse(content)
  const results = parsed.results || parsed || []

  return results.map((r: any) => ({
    id: transcripts[r.index]?.id,
    meetingId: transcripts[r.index]?.meetingId,
    relevance: r.relevance,
    snippet: r.snippet,
  })).filter((r: any) => r.id)
}

export async function generateOrganizationInsights(
  transcriptSummaries: Array<{
    department: string
    sentiment: any
    keyPoints: string[]
    commonThemes: string[]
    qualityScore: number
  }>
): Promise<{
  overallScore: number
  topIssues: string[]
  topStrengths: string[]
  departmentScores: Record<string, number>
  recommendations: string[]
  trendAnalysis: string
}> {
  const systemPrompt = `You are an organizational analyst. Analyze aggregated one-on-one meeting data 
to provide organization-wide insights, identify common issues, and make recommendations.`

  const userPrompt = `Analyze these aggregated meeting summaries from across the organization:

${JSON.stringify(transcriptSummaries, null, 2)}

Provide organization-wide insights in JSON format:
{
  "overallScore": number 1-100,
  "topIssues": ["issue1", "issue2", ...] (max 5),
  "topStrengths": ["strength1", "strength2", ...] (max 5),
  "departmentScores": { "dept1": score, "dept2": score, ... },
  "recommendations": ["recommendation1", "recommendation2", ...] (max 5),
  "trendAnalysis": "Brief analysis of trends and patterns"
}

Only respond with valid JSON.`

  const openai = await getOpenAIClient()
  const models = await getModels()

  const response = await openai.chat.completions.create({
    model: models.gptModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  })

  const content = response.choices[0].message.content
  if (!content) {
    throw new Error('No response from OpenAI')
  }

  return JSON.parse(content)
}
