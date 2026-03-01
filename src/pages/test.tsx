export default function TestPage() {
  return (
    <main className="p-8 bg-gradient-to-b from-slate-900 to-slate-800 min-h-screen text-white">
      <h1 className="text-4xl font-bold mb-4">✅ CSS Works!</h1>
      <p className="text-lg text-slate-300 mb-8">
        Du siehst diese Seite mit schönem Styling? Dann funktioniert Tailwind!
      </p>
      
      <div className="grid grid-cols-2 gap-4 max-w-2xl">
        <div className="bg-blue-600 p-6 rounded-lg shadow-lg">
          <h2 className="font-semibold mb-2">Card 1</h2>
          <p>Test</p>
        </div>
        <div className="bg-green-600 p-6 rounded-lg shadow-lg">
          <h2 className="font-semibold mb-2">Card 2</h2>
          <p>Test</p>
        </div>
      </div>
      
      <a href="/" className="mt-8 inline-block bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg">
        Zurück zur Dashboard
      </a>
    </main>
  );
}
