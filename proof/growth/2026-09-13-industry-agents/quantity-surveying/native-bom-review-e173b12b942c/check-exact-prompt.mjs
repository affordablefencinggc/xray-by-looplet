import {readFile} from 'node:fs/promises';
import {isDiscussionOnlyObjective,prohibitsAllTools} from 'file:///C:/Users/danie/XRayBuilds/industry-visible-20260913/concurrency-source/src/studio/assistant/discussionOnly.ts';
const text=await readFile('C:/Users/danie/XRayBuilds/industry-visible-20260913/quantity-surveying/native-bom-review-e173b12b942c/prompt.txt','utf8');
console.log(JSON.stringify({bytes:text.length,noTools:prohibitsAllTools(text),discussion:isDiscussionOnlyObjective(text)}));
if(!prohibitsAllTools(text)||!isDiscussionOnlyObjective(text))process.exitCode=1;