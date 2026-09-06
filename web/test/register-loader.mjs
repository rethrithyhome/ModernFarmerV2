// ចុះឈ្មោះ loader មុនតេស្តទាំងអស់ដំណើរការ (Node ត្រូវការចុះឈ្មោះនៅដំណាក់កាល
// ខាងក្រៅ មិនអាចហៅ module.register() ពីខាងក្នុងឯកសារតេស្តខ្លួនឯងទាន់ពេលទេ)
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./jsx-loader.mjs', pathToFileURL('./test/'));
