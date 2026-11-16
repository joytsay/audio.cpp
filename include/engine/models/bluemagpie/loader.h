#pragma once
#include "engine/framework/runtime/model.h"
namespace engine::models::bluemagpie {
std::shared_ptr<runtime::IVoiceModelLoader> make_bluemagpie_loader();
}
