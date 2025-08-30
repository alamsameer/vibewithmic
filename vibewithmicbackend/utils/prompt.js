export const  promptTemplat =`{
  "response_analysis": {
    "lines": [
      {
        "original": "string",                  // The original spoken line
        "improved_version": "string",          // Recommended improved version
        "filler_words_list": ["string"],       // List of filler words in this line
        "repeated_phrases": ["string"],        // List of repeated phrases in this line
        "vague_or_awkward_list": ["string"],   // List of vague or awkward phrases
        "filler_words": "number",              // Count of filler words
        "repetition": "number",                // Count of repetitions
        "vague_or_awkward": "number",          // Count of vague/awkward phrases
        "confidence_level": "number"           // Confidence score (0–100)
      }
    ],
    "totals": {
      "filler_words": "number",                // Total filler words across all lines
      "repetition": "number",                  // Total repetitions
      "vague_or_awkward": "number",            // Total vague/awkward phrases
      "overall_mistakes": "number",            // Total mistakes = sum of counts
      "overall_confidence_level": "number"     // Average or computed confidence level
    },
    "metadata": {
      "response_id": "string|number",          // Optional: unique ID for this response
      "analyzed_at": "datetime",               // Timestamp of analysis
      "analyzer_version": "string"             // Optional: version of analysis method/tool
    }
  }
}
`

export  const  systemPrompt='I want you to act as a speech improvement assistant. I will provide you with a transcript of a spoken response, and your task is to analyze it for common speech issues such as filler words (e.g., "um," "uh," "like"), repeated phrases, and vague or awkward language. Please provide specific feedback on each line of the transcript, including an improved version of the line without these issues. Additionally, summarize the total counts of filler words, repetitions, and vague phrases in the entire response. Your analysis should be structured in a JSON format as shown below. Ensure that your feedback is constructive and aimed at helping improve the clarity and professionalism of the speech.'

export const  userPrompt=`Here is the transcript of the spoken response:I want to understand about the SQL statements. Like how-- what are the SQL statements present and how all this, uh, can be used together to solve the questions (laughs).`
export const  exampleResponse=`{
  "response_analysis": {
    "lines": [      

        {
        "original": "Well, uh, the last estimate, uh, I think I can solve it with, uh, max heap.",
        "improved_version": "I believe I can solve the last estimate using a max heap.",
        "filler_words_list": ["uh", "uh", "uh"],
        "repeated_phrases": [],
        "vague_or_awkward_list": ["the last estimate"],
        "filler_words": 3,
        "repetition": 0,
        "vague_or_awkward": 1,
        "confidence_level": 90  
        },
        {
        "original": "Like, for each stone, uh, I push that into max heap.",
        "improved_version": "For each stone, I push it into the max heap.", 
        "filler_words_list": ["Like", "uh"],
        "repeated_phrases": [],
        "vague_or_awkward_list": [],
        "filler_words": 2,
        "repetition": 0,
        "vague_or_awkward": 0,
        "confidence_level": 95  
}],
    "totals": {
      "filler_words": 5,        
        "repetition": 0,
        "vague_or_awkward": 1,
        "overall_mistakes": 6,
        "overall_confidence_level": 92.5
    },

    "metadata": {
      "response_id": "resp_001",
      "analyzed_at": "2024-06-01T12:00:00Z",        
        "analyzer_version": "1.0.0"
    }
  }
}`  

export  const  combinedPrompt=`${systemPrompt}\n\n${userPrompt}\n\nPlease provide your analysis in the specified JSON format. Here is an example of the expected output:\n\n${exampleResponse}`