import numpy as np
import json
import sys
import os

def main():
    try:
        data_path = '/Users/juanjuanhuang/Desktop/Python/Dr-XAS-Website/EXAFS_plotting/EXAFS_plot_data_txt/wavelet_2D_matrix.txt'
        out_path = '/Users/juanjuanhuang/Desktop/Python/Dr-XAS-Website/magma-particles-demo/wavelet_data.json'
        
        # Load text data, skipping the first row which has a hash string comment
        with open(data_path, 'r') as f:
            lines = f.readlines()
            
        # The first line is "# wavelet magnitude matrix; rows follow wavelet_R_axis.txt, columns follow wavelet_k_axis.txt"
        data_lines = [l for l in lines if not l.startswith('#')]
        
        matrix = []
        for line in data_lines:
            row = [float(x) for x in line.split()]
            if row:
                matrix.append(row)
                
        data = np.array(matrix)
        print(f"Data shape: {data.shape}")
        
        # We need to downsample this heavily for three.js particles.
        # Target ~100x100 = 10000 particles 
        rows, cols = data.shape
        target_rows = 100
        target_cols = 100
        
        step_r = max(1, rows // target_rows)
        step_c = max(1, cols // target_cols)
        
        downsampled = data[::step_r, ::step_c]
        print(f"Downsampled shape: {downsampled.shape}")
        
        # Normalize between 0 and 1 so three.js logic stays simple
        d_min = np.min(downsampled)
        d_max = np.max(downsampled)
        print(f"Original downsampled min: {d_min}, max: {d_max}")
        
        if d_max > d_min:
            normalized = (downsampled - d_min) / (d_max - d_min)
        else:
            normalized = downsampled
            
        # Apply some non-linear scaling (like square root) since peaks are sharp 
        # compared to the flat regions, which is common in wavelets.
        normalized = np.sqrt(normalized)
            
        out_data = {
            "rows": normalized.shape[0],
            "cols": normalized.shape[1],
            "data": [round(float(x), 4) for x in normalized.flatten()]
        }
        
        with open(out_path, 'w') as f:
            json.dump(out_data, f)
            
        print(f"Successfully wrote normalized data to {out_path}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
