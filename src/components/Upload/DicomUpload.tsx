import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileCheck2, X } from 'lucide-react';
import { Box, Typography, Button } from '@mui/material';

interface DicomUploadProps {
  value: File | null;
  onChange: (file: File | null) => void;
  error?: string;
}

export function DicomUpload({ value, onChange, error }: DicomUploadProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    accept: { 'application/dicom': ['.dcm'] },
    onDrop: (acceptedFiles) => {
      if (acceptedFiles[0]) onChange(acceptedFiles[0]);
    },
  });

  return (
    <Box>
      <Typography variant="body2" fontWeight={600} mb={0.5}>
        Upload de Exame (DICOM)
      </Typography>

      <Box
        {...getRootProps()}
        sx={{
          border: '2px dashed',
          borderColor: error ? 'error.main' : isDragActive ? '#a3226e' : '#ccc',
          borderRadius: 1,
          p: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          backgroundColor: isDragActive ? 'rgba(163,34,110,0.04)' : 'transparent',
        }}
      >
        <input {...getInputProps()} />

        <Box display="flex" alignItems="center" gap={1}>
          {value ? (
            <FileCheck2 size={20} color="#a3226e" />
          ) : (
            <UploadCloud size={20} color="#888" />
          )}
          <Typography variant="body2" color={value ? 'text.primary' : 'text.secondary'}>
            {value ? value.name : 'Arraste o arquivo aqui ou clique para selecionar'}
          </Typography>
        </Box>

        {value ? (
          <Button
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            startIcon={<X size={16} />}
          >
            Remover
          </Button>
        ) : (
          <Button
            size="small"
            variant="outlined"
            sx={{ borderColor: '#a3226e', color: '#a3226e' }}
          >
            Selecionar Arquivo
          </Button>
        )}
      </Box>

      {error && (
        <Typography variant="caption" color="error" mt={0.5} display="block">
          {error}
        </Typography>
      )}
    </Box>
  );
}