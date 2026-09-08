import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({plugins:[react(),tailwindcss()],cacheDir:'/tmp/school-student-storage-ui-qa-vite',server:{host:'127.0.0.1',port:3117,hmr:false}});
