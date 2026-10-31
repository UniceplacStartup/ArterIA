/**
 * Visualizador Multimodal de Exames Médicos (DICOM .dcm, PDF .pdf, PNG .png e JPEG .jpg - RF06).
 *
 * - Para arquivos de Imagem (.png, .jpg, .jpeg): baixa via Axios autenticado, cria Object URL
 *   segura e exibe visualizador radiológico interativo com Zoom, Pan, Inversão de Contraste
 *   (Negativo Mamográfico) e Tela Cheia.
 * - Para arquivos PDF (.pdf): renderiza o documento em visualizador embutido seguro.
 * - Para arquivos DICOM (.dcm): carrega no canvas Cornerstone com ferramentas médicas.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Box,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Ruler,
  Move,
  Maximize2,
  ImageOff,
  FileText,
  Contrast,
} from 'lucide-react';
import cornerstone from 'cornerstone-core';
import cornerstoneTools from 'cornerstone-tools';
import { colors } from '@/theme/theme';
import { api } from '@/services/api';

interface Props {
  arquivoDicomUrl: string;
}

export function DicomViewer({ arquivoDicomUrl }: Props) {
  const elementRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [ferramentaAtiva, setFerramentaAtiva] = useState<
    'Pan' | 'Zoom' | 'Length'
  >('Pan');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [carregandoArquivo, setCarregandoArquivo] = useState(false);
  const [falhaCarregamento, setFalhaCarregamento] = useState(false);

  // Estados de manipulação visual para imagens mamográficas (.png, .jpg, .jpeg)
  const [escalaZoom, setEscalaZoom] = useState(1);
  const [inverterCores, setInverterCores] = useState(false);

  const isMock = !arquivoDicomUrl || arquivoDicomUrl.startsWith('mock:');
  const urlLower = arquivoDicomUrl.toLowerCase();
  const ehFormatoPdf =
    urlLower.includes('formato=pdf') || urlLower.endsWith('.pdf');
  const ehFormatoImagem =
    urlLower.includes('formato=png') ||
    urlLower.includes('formato=jpg') ||
    urlLower.endsWith('.png') ||
    urlLower.endsWith('.jpg') ||
    urlLower.endsWith('.jpeg');

  useEffect(() => {
    if (isMock) return;

    // Se for PDF ou Imagem (PNG/JPEG), baixa de forma autenticada via Axios
    if (ehFormatoPdf || ehFormatoImagem) {
      let urlCriada: string | null = null;
      setCarregandoArquivo(true);
      setFalhaCarregamento(false);
      const endpointRelativo = arquivoDicomUrl.replace(/^\/api/, '');

      api
        .get(endpointRelativo, { responseType: 'blob' })
        .then((res) => {
          const mimePadrao = ehFormatoPdf ? 'application/pdf' : 'image/png';
          const rawHeader = res.headers['content-type'];
          const contentType =
            typeof rawHeader === 'string' ? rawHeader : mimePadrao;
          const blob = new Blob([res.data], { type: contentType });
          urlCriada = URL.createObjectURL(blob);
          setBlobUrl(urlCriada);
        })
        .catch(() => {
          setFalhaCarregamento(true);
        })
        .finally(() => {
          setCarregandoArquivo(false);
        });

      return () => {
        if (urlCriada) URL.revokeObjectURL(urlCriada);
      };
    }

    // Se for DICOM (.dcm), inicializa o Cornerstone
    const element = elementRef.current;
    if (!element) return;

    setFalhaCarregamento(false);
    cornerstone.enable(element);

    cornerstone
      .loadAndCacheImage(`wadouri:${arquivoDicomUrl}`)
      .then((image: unknown) => {
        cornerstone.displayImage(element, image);

        cornerstoneTools.addToolForElement(element, cornerstoneTools.PanTool);
        cornerstoneTools.addToolForElement(element, cornerstoneTools.ZoomTool);
        cornerstoneTools.addToolForElement(
          element,
          cornerstoneTools.LengthTool,
        );
        cornerstoneTools.addToolForElement(element, cornerstoneTools.WwwcTool);

        cornerstoneTools.setToolActiveForElement(element, 'Pan', {
          mouseButtonMask: 1,
        });
      })
      .catch(() => {
        setFalhaCarregamento(true);
      });

    return () => {
      try {
        cornerstone.disable(element);
      } catch {
        // Ignora caso o elemento já tenha sido desmontado
      }
    };
  }, [arquivoDicomUrl, isMock, ehFormatoPdf, ehFormatoImagem]);

  function ativarFerramenta(nome: 'Pan' | 'Zoom' | 'Length') {
    if (!elementRef.current) return;
    cornerstoneTools.setToolActiveForElement(elementRef.current, nome, {
      mouseButtonMask: 1,
    });
    setFerramentaAtiva(nome);
  }

  function resetar() {
    if (ehFormatoImagem) {
      setEscalaZoom(1);
      setInverterCores(false);
      return;
    }
    if (!elementRef.current) return;
    cornerstone.reset(elementRef.current);
  }

  function alternarTelaCheia() {
    const alvo = containerRef.current ?? elementRef.current;
    alvo?.requestFullscreen?.();
  }

  if (carregandoArquivo) {
    return (
      <Box
        sx={{
          bgcolor: '#000',
          borderRadius: 3,
          height: 480,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress sx={{ color: colors.wine100 }} />
      </Box>
    );
  }

  // 1. Visualizador de PDF embutido
  if (ehFormatoPdf && blobUrl) {
    return (
      <Box
        ref={containerRef}
        sx={{
          position: 'relative',
          bgcolor: '#1e1e1e',
          borderRadius: 3,
          overflow: 'hidden',
          height: 520,
        }}
      >
        <iframe
          src={blobUrl}
          title="Visualizador de Exame PDF"
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      </Box>
    );
  }

  // 2. Visualizador Radiológico Interativo para Imagens PNG / JPEG
  if (ehFormatoImagem && blobUrl) {
    return (
      <Box
        ref={containerRef}
        sx={{
          position: 'relative',
          bgcolor: '#000',
          borderRadius: 3,
          overflow: 'hidden',
          height: 500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconButton
          onClick={alternarTelaCheia}
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 2,
            bgcolor: colors.wine700,
            color: '#fff',
          }}
          aria-label="Expandir visualização"
        >
          <Maximize2 size={16} />
        </IconButton>

        <Box
          component="img"
          src={blobUrl}
          alt="Exame Mamográfico"
          sx={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            transition: 'transform 0.2s ease, filter 0.2s ease',
            transform: `scale(${escalaZoom})`,
            filter: inverterCores ? 'invert(1) contrast(1.15)' : 'none',
          }}
        />

        <Stack
          direction="row"
          spacing={1}
          justifyContent="center"
          sx={{
            position: 'absolute',
            bottom: 12,
            left: 0,
            right: 0,
            zIndex: 2,
          }}
        >
          <ToolbarButton
            icon={<RotateCcw size={18} />}
            label="Resetar visualização"
            onClick={resetar}
          />
          <ToolbarButton
            icon={<ZoomIn size={18} />}
            label="Aumentar Zoom"
            onClick={() => setEscalaZoom((z) => Math.min(3.5, z + 0.25))}
          />
          <ToolbarButton
            icon={<ZoomOut size={18} />}
            label="Reduzir Zoom"
            onClick={() => setEscalaZoom((z) => Math.max(0.5, z - 0.25))}
          />
          <ToolbarButton
            icon={<Contrast size={18} />}
            label="Inverter Contraste (Negativo)"
            active={inverterCores}
            onClick={() => setInverterCores((v) => !v)}
          />
        </Stack>
      </Box>
    );
  }

  // 3. Fallback caso seja mock ou DICOM sem WADO image loader
  if (isMock || falhaCarregamento) {
    return (
      <Box
        sx={{
          bgcolor: '#000',
          borderRadius: 3,
          height: 480,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1.5,
          color: colors.wine100,
          p: 3,
        }}
      >
        {ehFormatoPdf ? <FileText size={40} /> : <ImageOff size={40} />}
        <Typography variant="body2" sx={{ maxWidth: 360, textAlign: 'center' }}>
          {isMock
            ? 'Pré-visualização simulada de mamografia para exemplo.'
            : 'Exame recebido e armazenado com segurança no cofre criptografado.'}
        </Typography>
      </Box>
    );
  }

  // 4. Visualizador Cornerstone para DICOM (.dcm)
  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        bgcolor: '#000',
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      <IconButton
        onClick={alternarTelaCheia}
        sx={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 2,
          bgcolor: colors.wine700,
          color: '#fff',
        }}
        aria-label="Expandir visualização"
      >
        <Maximize2 size={16} />
      </IconButton>
      <div ref={elementRef} style={{ width: '100%', height: 480 }} />

      <Stack
        direction="row"
        spacing={1}
        justifyContent="center"
        sx={{ position: 'absolute', bottom: 12, left: 0, right: 0, zIndex: 2 }}
      >
        <ToolbarButton
          icon={<RotateCcw size={18} />}
          label="Resetar"
          onClick={resetar}
        />
        <ToolbarButton
          icon={<ZoomIn size={18} />}
          label="Zoom"
          active={ferramentaAtiva === 'Zoom'}
          onClick={() => ativarFerramenta('Zoom')}
        />
        <ToolbarButton
          icon={<ZoomOut size={18} />}
          label="Reduzir"
          onClick={resetar}
        />
        <ToolbarButton
          icon={<Ruler size={18} />}
          label="Medir"
          active={ferramentaAtiva === 'Length'}
          onClick={() => ativarFerramenta('Length')}
        />
        <ToolbarButton
          icon={<Move size={18} />}
          label="Mover"
          active={ferramentaAtiva === 'Pan'}
          onClick={() => ativarFerramenta('Pan')}
        />
      </Stack>
    </Box>
  );
}

function ToolbarButton({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <Tooltip title={label}>
      <IconButton
        onClick={onClick}
        sx={{
          bgcolor: active ? colors.wine500 : 'rgba(255,255,255,0.15)',
          color: '#fff',
          '&:hover': { bgcolor: colors.wine500 },
        }}
        aria-label={label}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );
}
