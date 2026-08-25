import { useEffect, useRef, useState } from 'react';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { RotateCcw, ZoomIn, ZoomOut, Ruler, Move, Maximize2, ImageOff } from 'lucide-react';
import cornerstone from 'cornerstone-core';
import cornerstoneTools from 'cornerstone-tools';
import { colors } from '@/theme/theme';

interface Props {
  arquivoDicomUrl: string;
}

// RF06 

export function DicomViewer({ arquivoDicomUrl }: Props) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [ferramentaAtiva, setFerramentaAtiva] = useState<'Pan' | 'Zoom' | 'Length'>('Pan');

  
  const isMock = !arquivoDicomUrl || arquivoDicomUrl.startsWith('mock:');

  useEffect(() => {
    if (isMock) return;
    const element = elementRef.current;
    if (!element) return;

    cornerstone.enable(element);

    cornerstone
      .loadAndCacheImage(`wadouri:${arquivoDicomUrl}`)
      .then((image: unknown) => {
        cornerstone.displayImage(element, image);

       
        cornerstoneTools.addToolForElement(element, cornerstoneTools.PanTool);
        cornerstoneTools.addToolForElement(element, cornerstoneTools.ZoomTool);
        cornerstoneTools.addToolForElement(element, cornerstoneTools.LengthTool); // medição
        cornerstoneTools.addToolForElement(element, cornerstoneTools.WwwcTool); // window/level

        cornerstoneTools.setToolActiveForElement(element, 'Pan', { mouseButtonMask: 1 });
      })
      .catch(() => {
        // RE01
        console.error('Falha ao carregar imagem DICOM.');
      });

    return () => {
      cornerstone.disable(element);
    };
  }, [arquivoDicomUrl, isMock]);

  function ativarFerramenta(nome: 'Pan' | 'Zoom' | 'Length') {
    if (!elementRef.current) return;
    cornerstoneTools.setToolActiveForElement(elementRef.current, nome, { mouseButtonMask: 1 });
    setFerramentaAtiva(nome);
  }

  function resetar() {
    if (!elementRef.current) return;
    cornerstone.reset(elementRef.current);
  }

  function alternarTelaCheia() {
    elementRef.current?.requestFullscreen?.();
  }

  if (isMock) {
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
        }}
      >
        <ImageOff size={40} />
        <Typography variant="body2" sx={{ maxWidth: 320, textAlign: 'center' }}>
          Pré-visualização simulada para exemplo.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', bgcolor: '#000', borderRadius: 3, overflow: 'hidden' }}>
      <IconButton
        onClick={alternarTelaCheia}
        sx={{ position: 'absolute', top: 12, right: 12, zIndex: 2, bgcolor: colors.wine700, color: '#fff' }}
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
        <ToolbarButton icon={<RotateCcw size={18} />} label="Resetar" onClick={resetar} />
        <ToolbarButton
          icon={<ZoomIn size={18} />}
          label="Zoom"
          active={ferramentaAtiva === 'Zoom'}
          onClick={() => ativarFerramenta('Zoom')}
        />
        <ToolbarButton icon={<ZoomOut size={18} />} label="Reduzir" onClick={resetar} />
        <ToolbarButton icon={<Ruler size={18} />} label="Medir" onClick={() => ativarFerramenta('Length')} />
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
