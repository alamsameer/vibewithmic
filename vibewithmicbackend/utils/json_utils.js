import path from "path";
import fs from "fs";
export  function extractJsonFromResponse(responseText) {
  const firstBraceIndex = responseText.indexOf('{');
  const lastBraceIndex = responseText.lastIndexOf('}'); 
  if (firstBraceIndex !== -1 && lastBraceIndex !== -1 && lastBraceIndex > firstBraceIndex) {
    const jsonString = responseText.substring(firstBraceIndex, lastBraceIndex + 1);
    try {
      return JSON.parse(jsonString);
    }
    catch (error) {
      console.error("Error parsing JSON:", error);
      return null;
    }
  }
  else {
    console.error("No JSON object found in the response.");
    return null;
  }
}

export function  writeandAppendJsonToFile(jsonData){
  const filePath = path.join(process.cwd(), 'output.json');
  fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));
  console.log(`JSON data written to ${filePath}`);
} 
