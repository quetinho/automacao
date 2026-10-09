import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

const MyPreset = definePreset(Aura, {
    semantic: {
        // 1. Paleta Primária (Baseada no seu ícone)
        // Aura usa essa escala para botões, links, focos, etc.
        primary: {
            50: '#e6f9ff',
            100: '#ccf3ff',
            200: '#99e7ff',
            300: '#66dbff',
            400: '#33cfff',
            500: '#00A8E8', // Cor principal (Ciano escuro da sua logo)
            600: '#0097d7', // Hover
            700: '#0082c3', // Active
            800: '#006daf',
            900: '#00558c',
            950: '#003a61'
        },
        // 2. Mapeamento para o Modo Claro (Light Mode)
        colorScheme: {
            light: {
                primary: {
                    color: '{primary.500}',
                    contrastColor: '#ffffff',
                    hoverColor: '{primary.600}',
                    activeColor: '{primary.700}'
                },
                // Cor de fundo quando o usuário seleciona um texto ou dá foco
                highlight: {
                    background: '{primary.50}',
                    focusBackground: '{primary.100}',
                    color: '{primary.700}',
                    focusColor: '{primary.800}'
                },
                // Tons de cinza/azulado para fundos (O "Slate" dá um ar mais tecnológico)
                surface: {
                    0: '#ffffff',
                    50: '#f8fafc', // Fundo do sistema (bem clarinho, estilo tech)
                    100: '#f1f5f9', // Fundo de cards secundários
                    200: '#e2e8f0', // Bordas
                    300: '#cbd5e1',
                    400: '#94a3b8',
                    500: '#64748b', // Textos secundários
                    600: '#475569',
                    700: '#334155',
                    800: '#1e293b', // Textos principais
                    900: '#0f172a',
                    950: '#020617'
                }
            },
            // 3. Mapeamento para o Modo Escuro (Dark Mode)
            dark: {
                primary: {
                    // No modo escuro, usamos um tom mais claro do ciano para dar contraste
                    color: '{primary.400}', 
                    contrastColor: '{surface.900}',
                    hoverColor: '{primary.300}',
                    activeColor: '{primary.200}'
                },
                highlight: {
                    background: 'color-mix(in srgb, {primary.400}, transparent 84%)',
                    focusBackground: 'color-mix(in srgb, {primary.400}, transparent 76%)',
                    color: 'rgba(255,255,255,.87)',
                    focusColor: 'rgba(255,255,255,.87)'
                }
            }
        }
    }
});

export default MyPreset;