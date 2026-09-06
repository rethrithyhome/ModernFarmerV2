// Vercel serverless function
//
// ឯកសារនេះជា "ច្រកចូល" សម្រាប់សំណើ API ទាំងអស់នៅលើ Vercel។
// vercel.json បញ្ជូនគ្រប់សំណើ /api/* មកទីនេះ (មើលផ្នែក rewrites)។
// កូដពិតនៅ src/server.js ដដែល — ប្រើរួមគ្នាទាំង VPS និង Vercel។
export { default } from '../src/server.js';
