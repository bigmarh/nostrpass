import './index.css'

function App() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="min-h-screen flex pt-20 md:pt-0 md:items-center justify-center px-6">
        <div className="text-center flex md:flex-row flex-col m-w-4xl mx-auto">
          <div className="flex justify-center md:justify-end">
            <img src="/logo.svg" alt="NostrPass" className="w-[220px] md:w-[320px]" />
          </div>
          <div className="flex flex-col justify-center">
            <h2 className="text-gray-800 md:text-6xl font-bold text-4xl mb-2 tracking-tight">NostrPass</h2>
            <h3 className=" md:text-xl text-gray-600 mb-6 tracking-tight"> 
              Built by developers, for developers.</h3>
            <h1 className=" text-[1.85rem] leading-[1.85rem] md:text-5xl font-bold mb-6 tracking-tight">
              Authentication for the
              <br />modern decentralized web
            </h1>

            <p className="text-center text-sm md:text-xl text-gray-600 leading-relaxed">
              Drop-in authentication for Nostr apps.<br/>
              Add secure, privacy-first auth to your application
              in minutes, not days.
            </p>
          </div>
        </div>
      </div>
      <footer className="flex text-xs fixed w-full bottom-0 justify-center items-center">
          <p className="text-gray-500 mr-2">NostrPass</p>
          <p className="text-gray-500">© 2025 NostrPass. All rights reserved.</p>
      </footer>
    </div>
  )
}

export default App