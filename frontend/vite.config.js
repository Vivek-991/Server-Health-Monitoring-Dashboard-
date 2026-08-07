import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: parseInt(env.PORT || '3002'),
      open: false,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
        '/socket.io': {
          target: 'http://localhost:5000',
          ws: true,
        },
      },
    },
    define: {
      // Compatibility fallback for process.env in CRA code
      'process.env.REACT_APP_API_URL': JSON.stringify(env.REACT_APP_API_URL || env.VITE_API_URL || ''),
      'process.env.REACT_APP_SOCKET_URL': JSON.stringify(env.REACT_APP_SOCKET_URL || env.VITE_SOCKET_URL || ''),
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
  };
});
