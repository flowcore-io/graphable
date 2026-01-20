import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Public Test Page | Graphable",
  description: "Public test page to verify routing and deployment",
}

/**
 * Public test page - no authentication required
 * Used to verify the application is accessible through the ingress
 */
export default function PublicTestPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-libear-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-8 w-8 text-green-600"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">✅ Graphable is Running!</h1>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg bg-gray-50 p-4">
            <h2 className="mb-2 text-sm font-semibold text-gray-700">Connection Status</h2>
            <p className="text-sm text-gray-600">If you can see this page, the following components are working:</p>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              <li className="flex items-center">
                <span className="mr-2 text-green-500">✓</span>
                DNS resolution to graphable.usable.dev
              </li>
              <li className="flex items-center">
                <span className="mr-2 text-green-500">✓</span>
                Ingress routing
              </li>
              <li className="flex items-center">
                <span className="mr-2 text-green-500">✓</span>
                Next.js application
              </li>
              <li className="flex items-center">
                <span className="mr-2 text-green-500">✓</span>
                TLS/SSL certificate
              </li>
            </ul>
          </div>

          <div className="rounded-lg bg-blue-50 p-4">
            <h2 className="mb-2 text-sm font-semibold text-blue-900">Test Information</h2>
            <div className="space-y-1 text-sm text-blue-700">
              <p>
                <strong>Service:</strong> Graphable
              </p>
              <p>
                <strong>Environment:</strong> Production
              </p>
              <p>
                <strong>Time:</strong> {new Date().toISOString()}
              </p>
            </div>
          </div>

          <div className="pt-4">
            <a
              href="/"
              className="block w-full rounded-lg bg-indigo-600 px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              Go to Homepage
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
