import torch
import torch.nn as nn
from torchvision import models

class WasteClassifier(nn.Module):
    """
    MobileNetV3-based transfer learning vision classifier for 9 waste categories.
    Trained on the Merged Waste Classification Dataset (MWCD).
    """
    def __init__(self, num_classes=9, pretrained=True, dropout_rate=0.3):
        super().__init__()
        weights = models.MobileNet_V3_Small_Weights.DEFAULT if pretrained else None
        self.backbone = models.mobilenet_v3_small(weights=weights)
        
        # Original classifier has:
        # (0): Linear(in_features=576, out_features=1024, bias=True)
        # (1): Hardswish()
        # (2): Dropout(p=0.2, inplace=True)
        # (3): Linear(in_features=1024, out_features=1000, bias=True)
        in_features = self.backbone.classifier[0].in_features
        
        self.backbone.classifier = nn.Sequential(
            nn.Linear(in_features, 512),
            nn.Hardswish(),
            nn.Dropout(p=dropout_rate),
            nn.Linear(512, 256),
            nn.Hardswish(),
            nn.Dropout(p=dropout_rate * 0.7),
            nn.Linear(256, num_classes)
        )
        self.num_classes = num_classes

    def forward(self, x):
        return self.backbone(x)

    def predict_proba(self, x):
        logits = self.forward(x)
        return torch.softmax(logits, dim=1)

def get_waste_model(num_classes=9, pretrained=True, checkpoint_path=None, device='cpu'):
    model = WasteClassifier(num_classes=num_classes, pretrained=pretrained)
    if checkpoint_path:
        state_dict = torch.load(checkpoint_path, map_location=device, weights_only=True)
        if 'model_state_dict' in state_dict:
            model.load_state_dict(state_dict['model_state_dict'])
        else:
            model.load_state_dict(state_dict)
    model.to(device)
    return model
